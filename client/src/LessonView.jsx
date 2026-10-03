import { useState, useEffect, useRef, useCallback } from "react";
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import python from "highlight.js/lib/languages/python";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import sql from "highlight.js/lib/languages/sql";
import json from "highlight.js/lib/languages/json";
import typescript from "highlight.js/lib/languages/typescript";
import bash from "highlight.js/lib/languages/bash";
import QuizView from "./QuizView";
import DoubtBox from "./DoubtBox";

// Register common languages
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("css", css);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("json", json);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("shell", bash);

/* ── Code block with copy + syntax highlighting ── */
function CodeBlock({ code }) {
  const codeRef = useRef(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (codeRef.current) {
      hljs.highlightElement(codeRef.current);
    }
  }, [code]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard API may fail in some contexts */
    }
  }, [code]);

  return (
    <div className="code-block">
      <pre>
        <code ref={codeRef} className="hljs">
          {code}
        </code>
      </pre>
      <button
        className={`copy-btn ${copied ? "copy-btn--copied" : ""}`}
        onClick={handleCopy}
        aria-label={copied ? "Copied" : "Copy code"}
        type="button"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function LessonView({ topic, stepId, stepTitle, description, onBack }) {
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Quiz state
  const [quiz, setQuiz] = useState(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState("");
  const [showQuiz, setShowQuiz] = useState(false);

  useEffect(() => {
    async function fetchLesson() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/lesson", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic, stepId, stepTitle, description }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load lesson.");
        setLesson(data);
      } catch (err) {
        console.error("Lesson fetch error:", err.message);
        // Don't surface network/parse errors to the user — they're usually transient.
        // The lesson may have been saved; a retry (clicking the step again) will load it.
      } finally {
        setLoading(false);
      }
    }
    fetchLesson();
  }, [topic, stepId]);

  async function handleStartQuiz() {
    setQuizLoading(true);
    setQuizError("");
    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, stepId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load quiz.");
      setQuiz(data);
      setShowQuiz(true);
    } catch (err) {
      setQuizError(err.message);
    } finally {
      setQuizLoading(false);
    }
  }

  // ── Quiz view ──
  if (showQuiz && quiz) {
    return (
      <QuizView
        quiz={quiz}
        topic={topic}
        stepId={stepId}
        stepTitle={stepTitle}
        onBack={() => setShowQuiz(false)}
      />
    );
  }

  // ── Lesson view ──
  return (
    <div className="lesson">
      <button className="back-btn" onClick={onBack} type="button">
        ← Back to Roadmap
      </button>

      {loading && (
        <div className="lesson-loading">
          <div className="spinner" />
          <p>Generating lesson for <strong>{stepTitle}</strong>…</p>
        </div>
      )}

      {error && <p className="lesson-error">{error}</p>}

      {lesson && (
        <article>
          <header className="lesson__header">
            <p className="lesson__topic">{topic}</p>
            <h1 className="lesson__title">{lesson.title}</h1>
            {lesson.cached && <span className="lesson__badge">cached</span>}
          </header>

          {/* Introduction */}
          <section className="lesson__section">
            <h2>Introduction</h2>
            <p>{lesson.introduction}</p>
          </section>

          {/* Sections */}
          {lesson.sections && lesson.sections.length > 0 && (
            <section className="lesson__section">
              {lesson.sections.map((sec, i) => (
                <div key={i} className="lesson__content-block">
                  <h3>{sec.title}</h3>
                  <p>{sec.content}</p>
                </div>
              ))}
            </section>
          )}

          {/* Examples */}
          {lesson.examples && lesson.examples.length > 0 && (
            <section className="lesson__section">
              <h2>Examples</h2>
              {lesson.examples.map((ex, i) => (
                <div key={i} className="lesson__example">
                  <h4>{ex.title}</h4>
                  <CodeBlock code={ex.code} />
                </div>
              ))}
            </section>
          )}

          {/* Key Takeaways */}
          {lesson.keyTakeaways && lesson.keyTakeaways.length > 0 && (
            <section className="takeaway">
              <h2>Key Takeaways</h2>
              <ul>
                {lesson.keyTakeaways.map((point, i) => (
                  <li key={i}>{point}</li>
                ))}
              </ul>
            </section>
          )}

          {/* Doubt box */}
          <DoubtBox topic={topic} stepTitle={stepTitle} />

          {/* Quiz CTA */}
          <section className="quiz-card">            <h2>Test Your Understanding</h2>
            <p className="quiz-card__desc">
              {quiz?.cached
                ? "You have already taken this quiz — retake it any time."
                : "Take a short quiz to check how well you understood this lesson."}
            </p>
            {quizError && <p className="lesson-error">{quizError}</p>}
            <button
              className="btn-primary"
              onClick={handleStartQuiz}
              disabled={quizLoading}
              type="button"
            >
              {quizLoading
                ? "Loading quiz…"
                : quiz
                ? "Retake Quiz"
                : "Start Quiz"}
            </button>
          </section>
        </article>
      )}
    </div>
  );
}

export default LessonView;
