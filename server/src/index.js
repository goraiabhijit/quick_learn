import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import express from "express";
import cors from "cors";
import roadmapRouter from "./routes/roadmap.js";
import lessonRouter from "./routes/lesson.js";
import quizRouter from "./routes/quiz.js";
import revisionsRouter from "./routes/revisions.js";
import doubtRouter from "./routes/doubt.js";

// Load .env from server/ regardless of where the process is started from
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get("/", (req, res) => {
  res.send("Welcome to the Roadmap API");
});



app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/roadmap", roadmapRouter);
app.use("/api/lesson", lessonRouter);
app.use("/api/quiz", quizRouter);
app.use("/api/revisions", revisionsRouter);
app.use("/api/doubt", doubtRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
