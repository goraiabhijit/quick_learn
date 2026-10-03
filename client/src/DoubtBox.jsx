import { useState, useRef } from "react";

/**
 * Inline doubt / Q&A widget shown at the bottom of each lesson.
 * Props: topic (string), stepTitle (string)
 */
function DoubtBox({ topic, stepTitle }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  async function handleAsk(e) {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;

    setLoading(true);
    setError("");
    setAnswer("");

    try {
      const res = await fetch("/api/doubt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, stepTitle, question: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to get answer.");
      setAnswer(data.answer);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleNewQuestion() {
    setQuestion("");
    setAnswer("");
    setError("");
    inputRef.current?.focus();
  }

  return (
    <section className="doubt-box">
      <h2 className="doubt-box__title">Ask a Question</h2>
      <p className="doubt-box__desc">
        Got a doubt about this step? Ask anything and get an instant answer.
      </p>

      {!answer ? (
        <form className="doubt-box__form" onSubmit={handleAsk}>
          <textarea
            ref={inputRef}
            className="doubt-box__input"
            placeholder={`e.g. "What is the difference between props and state?"`}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            disabled={loading}
          />
          {error && <p className="doubt-box__error">{error}</p>}
          <button
            className="btn-primary"
            type="submit"
            disabled={loading || !question.trim()}
          >
            {loading ? "Asking…" : "Ask"}
          </button>
        </form>
      ) : (
        <div className="doubt-box__answer">
          <div className="doubt-box__question-echo">
            <span className="doubt-box__you">You asked:</span>
            <p>{question}</p>
          </div>
          <div className="doubt-box__response">
            <span className="doubt-box__ai-label">Answer</span>
            <p>{answer}</p>
          </div>
          <button
            className="doubt-box__ask-another"
            type="button"
            onClick={handleNewQuestion}
          >
            + Ask another question
          </button>
        </div>
      )}
    </section>
  );
}

export default DoubtBox;
