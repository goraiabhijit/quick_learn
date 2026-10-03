import { Link, useLocation } from "react-router-dom";
import { topicToId, findMatchingRoadmap } from "./utils";

function Sidebar({ savedRoadmaps = [] }) {
  const location = useLocation();
  const isNewActive = location.pathname === "/";
  const currentRoadmapId = location.pathname.startsWith("/roadmap/")
    ? location.pathname.slice("/roadmap/".length)
    : null;

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="sidebar__brand-icon">⚡</span>
        <span className="sidebar__title">Quick-Learn</span>
      </div>

      <p className="sidebar__section-label">Roadmaps</p>

      <ul className="sidebar__list">
        <li>
          <Link
            to="/"
            className={`roadmap-item ${isNewActive ? "roadmap-item--active" : ""}`}
          >
            <span className="roadmap-item__name">+ New roadmap</span>
          </Link>
        </li>

        {savedRoadmaps.map((item) => {
          const isActive =
            Boolean(currentRoadmapId) &&
            findMatchingRoadmap([item], currentRoadmapId) != null;

          return (
            <li key={item.topic}>
              <Link
                to={`/roadmap/${topicToId(item.topic)}`}
                className={`roadmap-item ${isActive ? "roadmap-item--active" : ""}`}
              >
                <span className="roadmap-item__name">{item.topic}</span>
                <span className="roadmap-item__count">{item.stepCount} steps</span>
              </Link>
            </li>
          );
        })}
      </ul>

      {savedRoadmaps.length === 0 && (
        <p className="sidebar__empty">No roadmaps yet.</p>
      )}
    </aside>
  );
}

export default Sidebar;
