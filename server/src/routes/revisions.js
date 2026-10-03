import { Router } from "express";
import { readFile, writeFile } from "fs/promises";
import { fileURLToPath } from "url";
import path from "path";

const router = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REVISIONS_FILE = path.join(__dirname, "../../data/revisions.json");

// ---------- helpers ----------

async function readRevisions() {
  const raw = await readFile(REVISIONS_FILE, "utf-8");
  return JSON.parse(raw);
}

async function writeRevisions(data) {
  await writeFile(REVISIONS_FILE, JSON.stringify(data, null, 2), "utf-8");
}

// ---------- routes ----------

// GET /api/revisions - return all steps that need revision
router.get("/", async (req, res) => {
  try {
    const store = await readRevisions();
    return res.json(store.revisions);
  } catch (err) {
    console.error("Error reading revisions:", err.message);
    return res.status(500).json({ error: "Failed to load revisions." });
  }
});

// POST /api/revisions/result - log quiz results, update revision list
// Body: { topic, stepId, stepTitle, answers: [{ questionId, correct: bool }] }
router.post("/result", async (req, res) => {
  const { topic, stepId, stepTitle, answers } = req.body;

  if (!topic || !stepId || !stepTitle || !Array.isArray(answers)) {
    return res.status(400).json({ error: "topic, stepId, stepTitle, and answers are required." });
  }

  const wrongCount = answers.filter((a) => !a.correct).length;

  try {
    const store = await readRevisions();

    const existingIndex = store.revisions.findIndex(
      (r) => r.topic.toLowerCase() === topic.toLowerCase() && r.stepId === Number(stepId)
    );

    if (wrongCount === 0) {
      // Perfect score — remove from revision list if present
      if (existingIndex !== -1) {
        store.revisions.splice(existingIndex, 1);
      }
    } else {
      const entry = {
        topic,
        stepId: Number(stepId),
        stepTitle,
        wrongCount,
        totalQuestions: answers.length,
        lastAttempt: new Date().toISOString(),
      };

      if (existingIndex !== -1) {
        store.revisions[existingIndex] = entry; // update existing
      } else {
        store.revisions.push(entry); // add new
      }
    }

    await writeRevisions(store);
    return res.json({ logged: true, needsRevision: wrongCount > 0 });
  } catch (err) {
    console.error("Error saving revision:", err.message);
    return res.status(500).json({ error: "Failed to save revision data." });
  }
});

// DELETE /api/revisions - clear a specific revision entry
// Body: { topic, stepId }
router.delete("/", async (req, res) => {
  const { topic, stepId } = req.body;
  if (!topic || !stepId) {
    return res.status(400).json({ error: "topic and stepId are required." });
  }
  try {
    const store = await readRevisions();
    store.revisions = store.revisions.filter(
      (r) => !(r.topic.toLowerCase() === topic.toLowerCase() && r.stepId === Number(stepId))
    );
    await writeRevisions(store);
    return res.json({ cleared: true });
  } catch (err) {
    return res.status(500).json({ error: "Failed to clear revision." });
  }
});

export default router;
