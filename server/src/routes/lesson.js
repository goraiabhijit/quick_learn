import { Router } from "express";
import { readFile, writeFile } from "fs/promises";
import { fileURLToPath } from "url";
import path from "path";
import { GoogleGenAI } from "@google/genai";

const router = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "../../data/roadmaps.json");

const MODEL = "models/gemma-4-26b-a4b-it";
const MAX_ITERATIONS = 5;   // hard cap — never call the model more than this
const TOKENS_PER_CHUNK = 1024; // keep each response small and focused

// ---------- helpers ----------

async function readRoadmaps() {
  const raw = await readFile(DATA_FILE, "utf-8");
  return JSON.parse(raw);
}

async function writeRoadmaps(data) {
  await writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * Parse and strip markdown fences from a model response string.
 * Returns the parsed object or throws a descriptive error.
 */
function parseModelJSON(text) {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    throw new Error("Model returned invalid JSON: " + cleaned.slice(0, 300));
  }
}

/**
 * Iterative lesson generator.
 *
 * Each call asks the model for one chunk of content.
 * The model replies with:
 *   { done: false, sections: [...], examples: [...], keyTakeaways: [...] }
 * or, on its final chunk:
 *   { done: true,  sections: [...], examples: [...], keyTakeaways: [...] }
 *
 * We accumulate all chunks and stop when done === true OR we hit MAX_ITERATIONS.
 * The first iteration also generates title + introduction (one-time fields).
 */
async function generateLesson(topic, stepTitle, description) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_key_here") {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const ai = new GoogleGenAI({ apiKey });

  // Accumulated output
  const lesson = {
    title: "",
    introduction: "",
    sections: [],
    examples: [],
    keyTakeaways: [],
  };

  let iteration = 0;

  while (iteration < MAX_ITERATIONS) {
    iteration++;
    const isFirst = iteration === 1;

    const alreadyHas = {
      sections: lesson.sections.length,
      examples: lesson.examples.length,
      keyTakeaways: lesson.keyTakeaways.length,
    };

    const prompt = isFirst
      ? `You are generating structured lesson content in multiple iterations.

Topic: ${topic}
Roadmap step: ${stepTitle}
Description: ${description}

This is iteration 1. Generate the first part of the lesson.

Return ONLY valid JSON in exactly this shape:
{
  "done": false,
  "title": "full lesson title",
  "introduction": "2-3 sentence introduction to this step",
  "sections": [
    { "title": "...", "content": "2-4 sentences" }
  ],
  "examples": [
    { "title": "...", "code": "..." }
  ],
  "keyTakeaways": ["..."]
}

Rules:
- Generate 1-2 sections, 0-1 examples, 0-2 key takeaways in this chunk.
- Set "done": false if there is more content to add (more sections, examples, or takeaways).
- Set "done": true only if this chunk completes the lesson entirely.
- Keep code examples short and focused.
- Return ONLY the JSON object. No extra text.`

      : `You are continuing to generate lesson content in multiple iterations.

Topic: ${topic}
Roadmap step: ${stepTitle}

So far you have generated:
- ${alreadyHas.sections} section(s)
- ${alreadyHas.examples} example(s)
- ${alreadyHas.keyTakeaways} key takeaway(s)

This is iteration ${iteration} of maximum ${MAX_ITERATIONS}.

Return ONLY valid JSON in exactly this shape:
{
  "done": false,
  "sections": [
    { "title": "...", "content": "2-4 sentences" }
  ],
  "examples": [
    { "title": "...", "code": "..." }
  ],
  "keyTakeaways": ["..."]
}

Rules:
- Add 1-2 NEW sections (do not repeat what was already covered).
- Add 0-1 new examples if useful.
- Add 1-2 new key takeaways.
- Set "done": true when the lesson is complete. Set "done": false if more content is needed.
- If this is the last chunk, set "done": true.
- Return ONLY the JSON object. No extra text.`;

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: { maxOutputTokens: TOKENS_PER_CHUNK },
    });

    let chunk;
    try {
      chunk = parseModelJSON(response.text);
    } catch (e) {
      // If a mid-loop chunk fails to parse, stop with what we have so far
      console.warn(`Iteration ${iteration} parse error: ${e.message}. Stopping loop.`);
      break;
    }

    // Merge first-iteration-only fields
    if (isFirst) {
      lesson.title = chunk.title || stepTitle;
      lesson.introduction = chunk.introduction || "";
      // If the model gave us nothing useful on iteration 1, abort early
      if (!chunk.sections || chunk.sections.length === 0) {
        throw new Error("Model returned an empty first chunk. Please try again.");
      }
    }

    // Accumulate arrays
    if (Array.isArray(chunk.sections))     lesson.sections.push(...chunk.sections);
    if (Array.isArray(chunk.examples))     lesson.examples.push(...chunk.examples);
    if (Array.isArray(chunk.keyTakeaways)) lesson.keyTakeaways.push(...chunk.keyTakeaways);

    console.log(
      `Lesson iteration ${iteration}/${MAX_ITERATIONS} — done: ${chunk.done} | ` +
      `sections: ${lesson.sections.length}, examples: ${lesson.examples.length}, ` +
      `takeaways: ${lesson.keyTakeaways.length}`
    );

    // Stop if model signals completion
    if (chunk.done === true) break;
  }

  if (!lesson.title) {
    throw new Error("Model response is missing required fields.");
  }

  return lesson;
}

// ---------- route ----------

router.post("/", async (req, res) => {
  const { topic, stepId, stepTitle, description } = req.body;

  if (!topic || !stepId || !stepTitle) {
    return res.status(400).json({ error: "topic, stepId, and stepTitle are required." });
  }

  try {
    const store = await readRoadmaps();

    // 1. Find the roadmap
    const roadmapIndex = store.roadmaps.findIndex(
      (r) => r.topic.toLowerCase() === topic.trim().toLowerCase()
    );
    if (roadmapIndex === -1) {
      return res.status(404).json({
        error: `Roadmap for "${topic}" not found. Generate the roadmap first.`,
      });
    }

    // 2. Find the step
    const stepIndex = store.roadmaps[roadmapIndex].steps.findIndex(
      (s) => s.id === Number(stepId)
    );
    if (stepIndex === -1) {
      return res.status(404).json({ error: `Step ${stepId} not found in roadmap.` });
    }

    const step = store.roadmaps[roadmapIndex].steps[stepIndex];

    // 3. Return cached lesson if it exists
    if (step.lesson) {
      return res.json({ ...step.lesson, cached: true });
    }

    // 4. Generate lesson via iterative loop
    const lesson = await generateLesson(
      topic,
      stepTitle,
      description || step.description
    );

    // 5. Only save if the lesson is usable
    if (lesson.title && lesson.sections && lesson.sections.length > 0) {
      store.roadmaps[roadmapIndex].steps[stepIndex].lesson = lesson;
      await writeRoadmaps(store);
    }

    return res.json(lesson);
  } catch (err) {
    console.error("Lesson generation error:", err.message);

    if (err.message.includes("GEMINI_API_KEY")) {
      return res.status(500).json({ error: "API key not configured." });
    }
    return res.status(500).json({ error: err.message || "Failed to generate lesson. Please try again." });
  }
});

export default router;
