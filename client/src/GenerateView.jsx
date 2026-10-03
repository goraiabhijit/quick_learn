import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { topicToId } from "./utils";

function GenerateView({ savedRoadmaps, onRoadmapGenerated }) {
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function handleGenerate(e) {
    e.preventDefault();
    const trimmed = topic.trim();
    if (!trimmed || loading) return;

    setError("");

    // Check if a roadmap for the same topic already exists (case-insensitive, trimmed)
    const existing = savedRoadmaps.find(
      (r) => r.topic.trim().toLowerCase() === trimmed.toLowerCase()
    );

    if (existing) {
      navigate(`/roadmap/${topicToId(existing.topic)}`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/roadmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate roadmap.");
      }

      onRoadmapGenerated(data);
      navigate(`/roadmap/${topicToId(data.topic)}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="generate-view">
      <div className="generate-view__container">
        <h1 className="generate-view__title">Quick Learn</h1>
        <p className="generate-view__subtitle">What do you want to learn?</p>

        <form className="generate-view__form" onSubmit={handleGenerate}>
          <input
            className="generate-view__input"
            type="text"
            placeholder='e.g. "React", "Machine Learning", "SQL"'
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={loading}
            autoFocus
          />
          <button
            className="btn-primary"
            type="submit"
            disabled={loading || !topic.trim()}
          >
            {loading ? "Generating…" : "Generate Roadmap"}
          </button>
        </form>

        {error && <p className="generate-view__error">{error}</p>}
      </div>
    </div>
  );
}

export default GenerateView;
