import { Router } from "express";
import { readFile, writeFile } from "fs/promises";
import { fileURLToPath } from "url";
import path from "path";
import { GoogleGenAI } from "@google/genai";

const router = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "../../data/roadmaps.json");

// ---------- helpers ----------

async function readRoadmaps() {
  const raw = await readFile(DATA_FILE, "utf-8");
  return JSON.parse(raw);
}

async function writeRoadmaps(data) {
  await writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

function findRoadmap(roadmaps, topic) {
  return roadmaps.find(
    (r) => r.topic.toLowerCase() === topic.toLowerCase()
  );
}

// Strip lesson body from steps, replace with hasLesson + hasQuiz flags.
// Keeps the response small and tells the frontend which steps are cached.
function toClientRoadmap(roadmap) {
  return {
    ...roadmap,
    steps: roadmap.steps.map(({ lesson, quiz, ...step }) => ({
      ...step,
      hasLesson: lesson != null,
      hasQuiz: quiz != null,
    })),
  };
}

async function generateRoadmap(topic) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_key_here") {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = "models/gemma-4-26b-a4b-it";

  const prompt = `Generate a structured learning roadmap for the topic: "${topic}".
Return ONLY valid JSON with no additional text, markdown, or explanation.
The JSON must follow this exact structure:
{
  "topic": "${topic}",
  "steps": [
    {
      "id": 1,
      "title": "Step title",
      "description": "One or two sentences describing what this step covers."
    }
  ]
}
Rules:
- Start from fundamentals.
- Progress logically from beginner to advanced.
- Include 8 to 12 steps.
- Do NOT include detailed lesson content, only titles and short descriptions.
- Return only the JSON object, nothing else.`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
  });

  const text = response.text.trim();
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("Model returned invalid JSON: " + cleaned.slice(0, 200));
  }

  if (!parsed.topic || !Array.isArray(parsed.steps)) {
    throw new Error("Model response is missing required fields.");
  }

  return parsed;
}

// ---------- routes ----------

// GET /api/roadmap - return all saved roadmaps (topic + step count)
router.get("/", async (req, res) => {
  try {
    const store = await readRoadmaps();
    const list = store.roadmaps.map((r) => ({
      topic: r.topic,
      stepCount: r.steps.length,
    }));
    return res.json(list);
  } catch (err) {
    console.error("Error reading roadmaps:", err.message);
    return res.status(500).json({ error: "Failed to load roadmaps." });
  }
});

// POST /api/roadmap - generate or return a roadmap for a topic
router.post("/", async (req, res) => {
  const { topic } = req.body;

  if (!topic || typeof topic !== "string" || topic.trim() === "") {
    return res.status(400).json({ error: "topic is required." });
  }

  const trimmedTopic = topic.trim();

  try {
    const store = await readRoadmaps();
    const existing = findRoadmap(store.roadmaps, trimmedTopic);

    if (existing) {
      return res.json({ ...toClientRoadmap(existing), cached: true });
    }

    const roadmap = await generateRoadmap(trimmedTopic);
    store.roadmaps.push(roadmap);
    await writeRoadmaps(store);

    return res.json(toClientRoadmap(roadmap));
  } catch (err) {
    console.error("Roadmap generation error:", err.message);
    if (err.message.includes("GEMINI_API_KEY")) {
      return res.status(500).json({ error: "API key not configured. Add GEMINI_API_KEY to .env." });
    }
    if (err.message.includes("invalid JSON") || err.message.includes("missing required fields")) {
      return res.status(500).json({ error: "Model returned an unexpected response. Please try again." });
    }
    return res.status(500).json({ error: "Failed to generate roadmap. Please try again." });
  }
});

export default router;
