# Quick Learn

An AI-powered learning app that turns any topic into a structured learning experience. Enter a topic, get a roadmap, read lessons, ask doubts, and test yourself — all generated on demand by Gemma 4 through the Google Gemini API.

---

## Features

### Roadmap Generation
Enter any topic (e.g. "React", "Machine Learning", "SQL") and the app generates a structured learning roadmap with 8–12 progressive steps. Roadmaps are cached — the same topic never calls the model twice.

### On-Demand Lessons
Click any roadmap step to generate a lesson for it. Each lesson includes an introduction, content sections, code examples, and key takeaways. Lessons are generated in chunks to avoid token limits and saved per step.

### Ask a Doubt
Every lesson has an inline Q&A box. Ask any question about the current step and get a focused, concise answer from the model — no context switching needed.

### Quiz
At the end of each lesson, take a 5-question quiz generated from the lesson content. The quiz uses a mix of multiple choice and true/false questions, each with an explanation. Generated once and cached per step.

### Revision Tracking
Wrong quiz answers automatically add the step to a revision list. Steps needing revision are highlighted with an amber badge on the roadmap. A perfect retake clears the badge.

### Persistent Caching
All generated content (roadmaps, lessons, quizzes, revision flags) is stored in `server/data/roadmaps.json` and `server/data/revisions.json`. No database required.

### VS Code-Style UI
The interface is styled after VS Code's dark theme — sidebar explorer, editor tabs, breadcrumbs, syntax-highlighted code blocks with a copy button, and a status bar. Supports dark and light high-contrast themes with a toggle that persists across sessions.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite |
| Backend | Node.js, Express |
| AI | Google Gemini API (Gemma 4 — `gemma-4-26b-a4b-it`) |
| Storage | JSON files (no database) |
| Styling | Plain CSS with CSS custom properties |

---

## Project Structure

```
quick_learn/
├── client/                    # React frontend (Vite)
│   ├── src/
│   │   ├── App.jsx            # Root layout, routing between views
│   │   ├── GenerateView.jsx   # Topic input and roadmap generation
│   │   ├── RoadmapView.jsx    # Roadmap step list
│   │   ├── LessonView.jsx     # Lesson content, doubt box, quiz CTA
│   │   ├── QuizView.jsx       # Quiz question flow and results
│   │   ├── DoubtBox.jsx       # Inline Q&A widget
│   │   ├── Sidebar.jsx        # Left panel with saved roadmaps
│   │   ├── ThemeContext.jsx   # Dark/light theme state
│   │   ├── ThemeToggle.jsx    # Theme switch button
│   │   ├── utils.js           # Shared helpers
│   │   └── vscode-theme.css   # All styles and design tokens
│   └── index.html
├── server/
│   ├── src/
│   │   ├── index.js           # Express app entry point
│   │   └── routes/
│   │       ├── roadmap.js     # GET+POST /api/roadmap
│   │       ├── lesson.js      # POST /api/lesson
│   │       ├── quiz.js        # POST /api/quiz
│   │       ├── doubt.js       # POST /api/doubt
│   │       └── revisions.js   # GET/POST/DELETE /api/revisions
│   └── data/
│       ├── roadmaps.json      # Cached roadmaps, lessons, quizzes
│       └── revisions.json     # Steps flagged for revision
├── package.json               # Root scripts (concurrently)
├── .gitignore
└── README.md
```

---

## Getting Started

### Prerequisites

- Node.js v18+
- npm v9+
- A [Google Gemini API key](https://aistudio.google.com/app/apikey)

### 1. Clone and install

```bash
git clone <repo-url>
cd quick_learn
npm run install:all
```

This installs dependencies for both `client/` and `server/`.

### 2. Configure the API key

Create `server/.env`:

```
GEMINI_API_KEY=your_key_here
```

### 3. Run

```bash
npm run dev
```

This starts both the backend (port 5000) and the frontend (port 5173) in one terminal using `concurrently`.

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:5000 |

---

## API Reference

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/health` | Server health check |
| `GET` | `/api/roadmap` | List all saved roadmaps |
| `POST` | `/api/roadmap` | Generate or return a roadmap for a topic |
| `POST` | `/api/lesson` | Generate or return a lesson for a step |
| `POST` | `/api/quiz` | Generate or return a quiz for a step |
| `POST` | `/api/doubt` | Answer a one-off question about a step |
| `GET` | `/api/revisions` | List all steps flagged for revision |
| `POST` | `/api/revisions/result` | Log quiz results and update revision flags |
| `DELETE` | `/api/revisions` | Clear a revision entry |

---

## How Caching Works

Every piece of generated content is stored in `server/data/roadmaps.json` inside the relevant roadmap step:

```json
{
  "roadmaps": [
    {
      "topic": "react",
      "steps": [
        {
          "id": 1,
          "title": "JavaScript Foundations",
          "description": "...",
          "lesson": { "title": "...", "sections": [], "examples": [], "keyTakeaways": [] },
          "quiz": { "questions": [] }
        }
      ]
    }
  ]
}
```

- Roadmap exists for topic → return it, skip Gemini
- Step has a lesson → return it, skip Gemini
- Step has a quiz → return it, skip Gemini
- Doubt answers are **not** cached (they're conversational and stateless)

Topic matching is case-insensitive: `"React"`, `"react"`, and `"REACT"` all resolve to the same roadmap.

---

## Theming

The UI supports high-contrast dark and light themes. The active theme is stored in `localStorage` under the key `ql-theme`. On first visit, the OS preference (`prefers-color-scheme`) is used. The toggle is available in the top-right of the interface.
