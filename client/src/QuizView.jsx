import { useState, useEffect } from "react";

function QuizView({ quiz, topic, stepId, stepTitle, onBack }) {
  const { questions } = quiz;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [finished, setFinished] = useState(false);

  const question = questions[currentIndex];
  const isLast = currentIndex === questions.length - 1;

  // Post results to server when quiz finishes
  useEffect(() => {
    if (!finished || answers.length === 0) return;
    const payload = {
      topic,
      stepId,
      stepTitle,
      answers: answers.map((a, i) => ({
        questionId: questions[i]?.id ?? i + 1,
        correct: a.selected === a.correct,
      })),
    };
    fetch("/api/revisions/result", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch((e) => console.warn("Failed to log revision:", e.message));
  }, [finished]);

  function handleSelect(optionIndex) {
    if (selected !== null) return;
    setSelected(optionIndex);
  }

  function handleNext() {
    const record = { selected, correct: question.correctAnswer };
    const newAnswers = [...answers, record];
    setAnswers(newAnswers);
    if (isLast) {
      setFinished(true);
    } else {
      setCurrentIndex((i) => i + 1);
      setSelected(null);
    }
  }

  const score = answers.filter((a) => a.selected === a.correct).length;

  // -- Results screen --
  if (finished) {
    const total = questions.length;
    const pct = Math.round((score / total) * 100);
    const msg = pct === 100 ? "Perfect score!" : pct >= 60 ? "Good job!" : "Keep practising!";

    return (
      <div className="quiz-container">
        <button className="back-btn" onClick={onBack} type="button">
          &larr; Back to Lesson
        </button>

        <div className="quiz-results">
          <div className="results-score">
            <span className="score-num">{score}</span>
            <span className="score-sep">/</span>
            <span className="score-total">{total}</span>
          </div>
          <p className="results-msg">{msg}</p>
          {score < total && (
            <p className="results-revision-note">
              This step has been added to your <strong>revision list</strong>.
            </p>
          )}

          <div className="results-breakdown">
            {questions.map((q, i) => {
              const a = answers[i];
              const correct = a.selected === a.correct;
              return (
                <div
                  key={q.id}
                  className={`result-item ${correct ? "result-item--correct" : "result-item--wrong"}`}
                >
                  <div className="result-item-header">
                    <span className="result-icon">{correct ? "✓" : "✗"}</span>
                    <span className="result-q-label">Question {q.id}</span>
                  </div>
                  <p className="result-question">{q.question}</p>
                  <p className="result-detail">
                    <strong>Your answer:</strong> {q.options[a.selected] ?? "—"}
                  </p>
                  {!correct && (
                    <p className="result-detail result-detail--correct">
                      <strong>Correct answer:</strong> {q.options[a.correct]}
                    </p>
                  )}
                  <p className="result-explanation">{q.explanation}</p>
                </div>
              );
            })}
          </div>

          <button className="quiz-btn" onClick={onBack} type="button">
            &larr; Back to Lesson
          </button>
        </div>
      </div>
    );
  }

  // -- Question screen --
  return (
    <div className="quiz-container">
      {/* Back button cancels the quiz — no results saved */}
      <button className="back-btn" onClick={onBack} type="button">
        &larr; Back to Lesson
      </button>

      <div className="quiz-progress">
        <div
          className="quiz-progress-bar"
          style={{ width: `${(currentIndex / questions.length) * 100}%` }}
        />
      </div>

      <p className="quiz-counter">
        Question {currentIndex + 1} of {questions.length}
      </p>

      <h2 className="quiz-question">{question.question}</h2>

      <ul className="quiz-options">
        {question.options.map((opt, i) => {
          let cls = "quiz-option";
          if (selected !== null) {
            if (i === question.correctAnswer) cls += " quiz-option--correct";
            else if (i === selected) cls += " quiz-option--wrong";
          } else if (selected === i) {
            cls += " quiz-option--selected";
          }
          return (
            <li key={i}>
              <button
                className={cls}
                onClick={() => handleSelect(i)}
                disabled={selected !== null}
                type="button"
              >
                <span className="option-letter">{String.fromCharCode(65 + i)}</span>
                {opt}
              </button>
            </li>
          );
        })}
      </ul>

      {selected !== null && (
        <div
          className={`quiz-feedback ${
            selected === question.correctAnswer
              ? "quiz-feedback--correct"
              : "quiz-feedback--wrong"
          }`}
        >
          <strong>
            {selected === question.correctAnswer ? "Correct!" : "Incorrect."}
          </strong>{" "}
          {question.explanation}
        </div>
      )}

      <button
        className="quiz-btn quiz-btn--next"
        onClick={handleNext}
        disabled={selected === null}
        type="button"
      >
        {isLast ? "See Results" : "Next Question →"}
      </button>
    </div>
  );
}

export default QuizView;
