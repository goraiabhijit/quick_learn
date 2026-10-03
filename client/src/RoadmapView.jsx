function RoadmapView({ roadmap, revisions = [], onStepClick }) {
  if (!roadmap) return null;

  const doneCount = roadmap.steps.filter((s) => s.hasLesson).length;
  const totalCount = roadmap.steps.length;
  const pct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;

  function stepNeedsRevision(stepId) {
    return revisions.some(
      (r) =>
        r.topic.toLowerCase() === roadmap.topic.toLowerCase() &&
        r.stepId === stepId
    );
  }

  return (
    <div className="roadmap-view">
      <section className="roadmap-section">
        <h2 className="roadmap-section__heading">
          {roadmap.topic} Learning Roadmap
          {roadmap.cached && <span className="badge badge--cached">cached</span>}
        </h2>

        <p className="roadmap-section__hint">Click any step to open its lesson.</p>

        <div className="roadmap-section__progress">
          <span className="roadmap-section__progress-text">
            {doneCount} of {totalCount} steps complete
          </span>
          <div className="roadmap-section__progress-track">
            <div
              className="roadmap-section__progress-fill"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <ol className="steps-list">
          {(() => {
            const currentStep = roadmap.steps.find((s) => !s.hasLesson) || roadmap.steps[0];
            return roadmap.steps.map((step) => {
              const needsRevision = stepNeedsRevision(step.id);
              const isCurrent = currentStep && currentStep.id === step.id;
              return (
                <li
                  key={step.id}
                  className={`step-item ${isCurrent ? "step-item--current" : ""} ${needsRevision ? "step-item--needs-revision" : ""}`}
                  onClick={() => onStepClick(step)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && onStepClick(step)}
                >
                <span
                  className={`step-item__circle ${step.hasLesson && !needsRevision ? "step-item__circle--done" : ""}`}
                >
                  {step.hasLesson && !needsRevision ? "✓" : step.id}
                </span>
                <div className="step-item__body">
                  <h3 className="step-item__title">
                    {step.title}
                    {needsRevision && (
                      <span className="badge badge--revise">revise</span>
                    )}
                  </h3>
                  <p className="step-item__desc">{step.description}</p>
                </div>
                <span className="step-item__arrow">→</span>
              </li>
            );
          });
        })()}
        </ol>
      </section>
    </div>
  );
}

export default RoadmapView;
