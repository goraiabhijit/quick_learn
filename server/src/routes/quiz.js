import { Router } from "express";
import { readFile, writeFile } from "fs/promises";
import { fileURLToPath } from "url";
import path from "path";
import { GoogleGenAI } from "@google/genai";

const router = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "../../data/roadmaps.json");

const MODEL = "models/gemma-4-26b-a4b-it";
const TARGET_QUESTIONS = 5;
const MAX_ITERATIONS = 6;       // hard cap
const TOKENS_PER_CHUNK = 1024;  // small enough to never truncate

// ---------- helpers ----------

async function readRoadmaps() {
  const raw = await readFile(DATA_FILE, "utf-8");
  return JSON.parse(raw);
}

async function writeRoadmaps(data) {
  await writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

function parseModelJSON(text) {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error("Model returned invalid JSON: " + cleaned.slice(0, 300));
  }
}

// Compact lesson into a short string so the prompt stays small
function lessonSummary(lesson) {
  const parts = [];
  if (lesson.introduction) parts.push(`Introduction: ${lesson.introduction}`);
  if (lesson.sections) {
    lesson.sections.forEach((s) => parts.push(`${s.title}: ${s.content}`));
  }
  if (lesson.keyTakeaways) {
    parts.push(`Key takeaways: ${lesson.keyTakeaways.join("; ")}`);
  }
  return parts.join("\n").slice(0, 1200); // hard cap — keep prompt short
}

function normaliseQuestion(q, index) {
  return {
    id: typeof q.id === "number" ? q.id : index + 1,
    type: q.type === "true_false" ? "true_false" : "multiple_choice",
    question: q.question ?? "",
    options: Array.isArray(q.options) ? q.options : [],
    correctAnswer: typeof q.correctAnswer === "number" ? q.correctAnswer : 0,
    explanation: q.explanation ?? "",
  };
}

/**
 * Iterative quiz generator.
 *
 * Each iteration asks for 1-2 questions. The model responds with:
 *   { "done": false, "questions": [...] }
 * or when finished:
 *   { "done": true,  "questions": [...] }
 *
 * We accumulate until we have TARGET_QUESTIONS or hit MAX_ITERATIONS.
 */
async function generateQuiz(topic, stepTitle, lesson) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_key_here") {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const summary = lessonSummary(lesson);
  const allQuestions = [];
  let iteration = 0;

  while (iteration < MAX_ITERATIONS && allQuestions.length < TARGET_QUESTIONS) {
    iteration++;
    const remaining = TARGET_QUESTIONS - allQuestions.length;
    const batchSize = Math.min(2, remaining); // ask for 1-2 at a time

    const prompt = `You are generating quiz questions to test a student's understanding of a lesson.

Topic: ${topic}
Lesson step: ${stepTitle}
Lesson summary:
${summary}

Questions generated so far: ${allQuestions.length} of ${TARGET_QUESTIONS}
Generate exactly ${batchSize} MORE question(s) (id starting at ${allQuestions.length + 1}).
Base questions ONLY on the lesson content above.

Rules:
- Use "multiple_choice" (4 options) or "true_false" (["True","False"]).
- correctAnswer is the 0-based index of the correct option.
- Every question needs a short explanation.
- Keep questions and options short (one sentence max).
- Set "done": true if this batch completes the ${TARGET_QUESTIONS} total, otherwise "done": false.

Return ONLY valid JSON. No markdown. Complete the object fully.
{
  "done": false,
  "questions": [
    {
      "id": ${allQuestions.length + 1},
      "type": "multiple_choice",
      "question": "...",
      "options": ["...", "...", "...", "..."],
      "correctAnswer": 0,
      "explanation": "..."
    }
  ]
}`;

    let chunk;
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: prompt,
      });
      const raw = response.text;
      console.log(`Quiz iteration ${iteration} raw (${typeof raw}):`, String(raw).slice(0, 400));
      chunk = parseModelJSON(raw);
    } catch (e) {
      console.warn(`Quiz iteration ${iteration} error (${e.constructor?.name}): ${e.message}`);
      break;
    }

    if (Array.isArray(chunk.questions)) {
      chunk.questions.forEach((q) => {
        allQuestions.push(normaliseQuestion(q, allQuestions.length));
      });
    }

    console.log(
      `Quiz iteration ${iteration}/${MAX_ITERATIONS} — done: ${chunk.done} | questions: ${allQuestions.length}/${TARGET_QUESTIONS}`
    );

    if (chunk.done === true || allQuestions.length >= TARGET_QUESTIONS) break;
  }

  if (allQuestions.length === 0) {
    throw new Error("Model failed to generate any questions. Please try again.");
  }

  // Re-number ids sequentially in case the model drifted
  allQuestions.forEach((q, i) => { q.id = i + 1; });

  return { questions: allQuestions };
}

// ---------- route ----------

router.post("/", async (req, res) => {
  const { topic, stepId } = req.body;

  if (!topic || !stepId) {
    return res.status(400).json({ error: "topic and stepId are required." });
  }

  try {
    const store = await readRoadmaps();

    // 1. Find roadmap
    const roadmapIndex = store.roadmaps.findIndex(
      (r) => r.topic.toLowerCase() === topic.trim().toLowerCase()
    );
    if (roadmapIndex === -1) {
      return res.status(404).json({ error: `Roadmap for "${topic}" not found.` });
    }

    // 2. Find step
    const stepIndex = store.roadmaps[roadmapIndex].steps.findIndex(
      (s) => s.id === Number(stepId)
    );
    if (stepIndex === -1) {
      return res.status(404).json({ error: `Step ${stepId} not found in roadmap.` });
    }

    const step = store.roadmaps[roadmapIndex].steps[stepIndex];

    // 3. Return cached quiz
    if (step.quiz) {
      return res.json({ ...step.quiz, cached: true });
    }

    // 4. Require lesson first
    if (!step.lesson) {
      return res.status(400).json({
        error: "Lesson must be generated before the quiz. Open the lesson first.",
      });
    }

    // 5. Generate via iterative loop
    const quiz = await generateQuiz(topic, step.title, step.lesson);

    // 6. Save only if we got at least one question
    if (quiz.questions.length > 0) {
      store.roadmaps[roadmapIndex].steps[stepIndex].quiz = quiz;
      await writeRoadmaps(store);
    }

    return res.json(quiz);
  } catch (err) {
    console.error("Quiz generation error:", err.message);
    if (err.message.includes("GEMINI_API_KEY")) {
      return res.status(500).json({ error: "API key not configured." });
    }
    return res.status(500).json({ error: err.message || "Failed to generate quiz." });
  }
});

export default router;
