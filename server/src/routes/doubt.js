import { Router } from "express";
import { GoogleGenAI } from "@google/genai";

const router = Router();
const MODEL = "models/gemma-4-26b-a4b-it";

// POST /api/doubt
// Body: { topic, stepTitle, question }
router.post("/", async (req, res) => {
  const { topic, stepTitle, question } = req.body;

  if (!topic || !stepTitle || !question || question.trim() === "") {
    return res.status(400).json({ error: "topic, stepTitle, and question are required." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_key_here") {
    return res.status(500).json({ error: "API key not configured." });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are a helpful tutor answering a student's question.

The student is currently studying: ${topic}
Roadmap step: ${stepTitle}
Student's question: ${question.trim()}

Answer the question clearly and concisely. Focus only on what was asked.
Keep the answer short (2-4 sentences) unless the question genuinely requires more.
If a code example helps, include a short one.
Do not lecture beyond the question.`;

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
    });

    const answer = response.text?.trim();
    if (!answer) {
      return res.status(500).json({ error: "Model returned an empty response. Please try again." });
    }

    return res.json({ answer });
  } catch (err) {
    console.error("Doubt error:", err.message);
    return res.status(500).json({ error: "Failed to get an answer. Please try again." });
  }
});

export default router;
