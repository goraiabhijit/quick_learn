import { useState, useEffect, useCallback } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation, useParams } from "react-router-dom";
import Sidebar from "./Sidebar";
import GenerateView from "./GenerateView";
import RoadmapView from "./RoadmapView";
import LessonView from "./LessonView";
import ThemeToggle from "./ThemeToggle";
import { topicToId, findMatchingRoadmap } from "./utils";

function RoadmapRouteContainer({
  savedRoadmaps,
  initialLoaded,
  roadmapsCache,
  setRoadmapsCache,
  revisions,
  loadRevisions,
  openTabs,
  setOpenTabs,
  activeTabId,
  setActiveTabId,
}) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const matched = findMatchingRoadmap(savedRoadmaps, id);

  // If saved roadmaps loaded and no match found, redirect to "/"
  useEffect(() => {
    if (initialLoaded && !matched) {
      navigate("/", { replace: true });
    }
  }, [initialLoaded, matched, navigate]);

  // Load roadmap data if matched
  useEffect(() => {
    if (!matched) return;

    const topicKey = matched.topic.trim().toLowerCase();
    const tabTitle = `${matched.topic.toLowerCase()}-roadmap.md`;
    const roadmapTabId = `roadmap-${topicKey}`;

    // Ensure tab exists for this roadmap
    setOpenTabs((prev) => {
      if (prev.some((t) => t.id === roadmapTabId)) return prev;
      return [
        ...prev,
        {
          id: roadmapTabId,
          type: "roadmap",
          filename: tabTitle,
          path: `/roadmap/${topicToId(matched.topic)}`,
          topic: matched.topic,
        },
      ];
    });

    // If active tab is not a lesson for this topic, set active tab to this roadmap tab
    setActiveTabId((currentActiveId) => {
      const active = openTabs.find((t) => t.id === currentActiveId);
      if (active && active.type === "lesson" && active.topic.toLowerCase() === topicKey) {
        return currentActiveId;
      }
      return roadmapTabId;
    });

    if (roadmapsCache[topicKey]) return;

    let cancelled = false;
    async function fetchRoadmap() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/roadmap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic: matched.topic }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load roadmap.");
        if (!cancelled) {
          setRoadmapsCache((prev) => ({
            ...prev,
            [topicKey]: data,
          }));
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchRoadmap();

    return () => {
      cancelled = true;
    };
  }, [matched?.topic]);

  if (!initialLoaded) {
    return (
      <div className="lesson-loading" style={{ margin: "auto" }}>
        <div className="spinner" />
        <p>Loading…</p>
      </div>
    );
  }

  if (!matched) {
    return <Navigate to="/" replace />;
  }

  const topicKey = matched.topic.trim().toLowerCase();
  const currentRoadmap = roadmapsCache[topicKey];

  if (loading && !currentRoadmap) {
    return (
      <div className="lesson-loading" style={{ margin: "auto" }}>
        <div className="spinner" />
        <p>Loading roadmap…</p>
      </div>
    );
  }

  if (error && !currentRoadmap) {
    return (
      <div className="roadmap-view">
        <p className="roadmap-view__error">{error}</p>
      </div>
    );
  }

  // Active tab check: is a lesson tab currently active for this roadmap?
  const activeTab = openTabs.find((t) => t.id === activeTabId);
  if (activeTab && activeTab.type === "lesson" && activeTab.topic.toLowerCase() === topicKey) {
    return (
      <LessonView
        key={activeTab.id}
        topic={activeTab.topic}
        stepId={activeTab.stepId}
        stepTitle={activeTab.stepTitle}
        description={activeTab.description}
        onBack={async () => {
          const roadmapTabId = `roadmap-${topicKey}`;
          setOpenTabs((prev) => prev.filter((t) => t.id !== activeTab.id));
          setActiveTabId(roadmapTabId);

          // Reload roadmap and revisions to update checkmarks
          try {
            const res = await fetch("/api/roadmap", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ topic: matched.topic }),
            });
            if (res.ok) {
              const data = await res.json();
              setRoadmapsCache((prev) => ({
                ...prev,
                [topicKey]: data,
              }));
            }
          } catch {}
          loadRevisions();
        }}
      />
    );
  }

  function handleStepClick(step) {
    const tabId = `lesson-${matched.topic}-${step.id}`;
    const slug = step.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const num = String(step.id).padStart(2, "0");

    const newTab = {
      id: tabId,
      type: "lesson",
      filename: `${num}-${slug}.js`,
      topic: matched.topic,
      stepId: step.id,
      stepTitle: step.title,
      description: step.description,
      path: `/roadmap/${topicToId(matched.topic)}`,
    };

    setOpenTabs((prev) => {
      if (prev.some((t) => t.id === tabId)) return prev;
      return [...prev, newTab];
    });
    setActiveTabId(tabId);
  }

  return (
    <RoadmapView
      roadmap={currentRoadmap}
      revisions={revisions}
      onStepClick={handleStepClick}
    />
  );
}

function App() {
  const location = useLocation();
  const navigate = useNavigate();

  // Sidebar list: [{ topic, stepCount }]
  const [savedRoadmaps, setSavedRoadmaps] = useState([]);
  const [initialLoaded, setInitialLoaded] = useState(false);

  // Cached roadmaps by lowercased topic: { [topicLower]: roadmapData }
  const [roadmapsCache, setRoadmapsCache] = useState({});

  // Revision list: [{ topic, stepId, stepTitle, wrongCount }]
  const [revisions, setRevisions] = useState([]);

  // Open editor tabs
  const NEW_ROADMAP_TAB = {
    id: "new-roadmap",
    type: "new-roadmap",
    filename: "new-roadmap",
    path: "/",
  };

  const [openTabs, setOpenTabs] = useState([NEW_ROADMAP_TAB]);
  const [activeTabId, setActiveTabId] = useState("new-roadmap");

  const loadSavedRoadmaps = useCallback(async () => {
    try {
      const res = await fetch("/api/roadmap");
      if (res.ok) {
        const data = await res.json();
        setSavedRoadmaps(data);
        return data;
      }
    } catch {
      /* sidebar failing shouldn't break the app */
    } finally {
      setInitialLoaded(true);
    }
    return [];
  }, []);

  const loadRevisions = useCallback(async () => {
    try {
      const res = await fetch("/api/revisions");
      if (res.ok) setRevisions(await res.json());
    } catch {
      /* non-critical */
    }
  }, []);

  useEffect(() => {
    loadSavedRoadmaps();
    loadRevisions();
  }, [loadSavedRoadmaps, loadRevisions]);

  // Synchronize route changes with tabs
  useEffect(() => {
    if (location.pathname === "/") {
      setOpenTabs((prev) => {
        if (prev.some((t) => t.id === "new-roadmap")) return prev;
        return [NEW_ROADMAP_TAB, ...prev];
      });
      setActiveTabId("new-roadmap");
    }
  }, [location.pathname]);

  function handleRoadmapGenerated(newRoadmap) {
    const topicKey = newRoadmap.topic.trim().toLowerCase();
    setRoadmapsCache((prev) => ({
      ...prev,
      [topicKey]: newRoadmap,
    }));
    setSavedRoadmaps((prev) => {
      if (prev.some((r) => r.topic.trim().toLowerCase() === topicKey)) {
        return prev;
      }
      return [...prev, { topic: newRoadmap.topic, stepCount: newRoadmap.steps.length }];
    });
    loadSavedRoadmaps();
  }

  function handleTabClick(tab) {
    setActiveTabId(tab.id);
    if (tab.path && tab.path !== location.pathname) {
      navigate(tab.path);
    }
  }

  function handleCloseTab(tabId, e) {
    e.stopPropagation();

    const closingTab = openTabs.find((t) => t.id === tabId);
    const idx = openTabs.findIndex((t) => t.id === tabId);
    const remaining = openTabs.filter((t) => t.id !== tabId);

    // If closing the only tab, don't leave empty tablist - reset to new-roadmap
    if (remaining.length === 0) {
      setOpenTabs([NEW_ROADMAP_TAB]);
      setActiveTabId("new-roadmap");
      navigate("/");
      return;
    }

    setOpenTabs(remaining);

    if (activeTabId === tabId) {
      // If closing a lesson tab, prefer returning to the parent roadmap tab
      if (closingTab?.type === "lesson") {
        const parentRoadmapTab = remaining.find(
          (t) => t.type === "roadmap" && t.topic?.toLowerCase() === closingTab.topic?.toLowerCase()
        );
        if (parentRoadmapTab) {
          setActiveTabId(parentRoadmapTab.id);
          if (parentRoadmapTab.path && parentRoadmapTab.path !== location.pathname) {
            navigate(parentRoadmapTab.path);
          }
          return;
        }
      }

      const nextTab = remaining[idx] || remaining[idx - 1] || remaining[0];
      if (nextTab) {
        setActiveTabId(nextTab.id);
        if (nextTab.path && nextTab.path !== location.pathname) {
          navigate(nextTab.path);
        }
      } else {
        navigate("/");
      }
    }
  }

  // Active tab & metadata for breadcrumb and status bar
  const activeTab = openTabs.find((t) => t.id === activeTabId) || openTabs[0];

  const currentRoadmapId = location.pathname.startsWith("/roadmap/")
    ? location.pathname.slice("/roadmap/".length)
    : null;
  const currentMatched = currentRoadmapId
    ? findMatchingRoadmap(savedRoadmaps, currentRoadmapId)
    : null;
  const currentCachedRoadmap = currentMatched
    ? roadmapsCache[currentMatched.topic.trim().toLowerCase()]
    : null;

  // Status bar info
  function renderStatusBar() {
    if (location.pathname === "/") {
      return (
        <footer className="status-bar">
          <span className="status-bar__item">⚡ Quick Learn</span>
          <span className="status-bar__spacer" />
          <ThemeToggle />
          <span className="status-bar__item">Ready</span>
        </footer>
      );
    }

    if (activeTab?.type === "lesson") {
      const steps = currentCachedRoadmap?.steps || [];
      const currentIdx = steps.findIndex((s) => s.id === activeTab.stepId);
      const total = steps.length || currentMatched?.stepCount || 0;

      return (
        <footer className="status-bar">
          <span className="status-bar__item">⚡ Quick Learn</span>
          <span className="status-bar__item">{activeTab.topic}</span>
          <span className="status-bar__spacer" />
          <ThemeToggle />
          <span className="status-bar__item">
            {currentIdx >= 0 ? `Step ${currentIdx + 1} of ${total}` : `${total} steps`}
          </span>
          <span className="status-bar__item">
            {openTabs.length} {openTabs.length === 1 ? "tab" : "tabs"}
          </span>
        </footer>
      );
    }

    // Roadmap view
    const totalSteps = currentCachedRoadmap?.steps?.length ?? currentMatched?.stepCount ?? 0;
    return (
      <footer className="status-bar">
        <span className="status-bar__item">⚡ Quick Learn</span>
        {currentMatched && (
          <span className="status-bar__item">{currentMatched.topic}</span>
        )}
        <span className="status-bar__spacer" />
        <ThemeToggle />
        <span className="status-bar__item">{totalSteps} steps</span>
        <span className="status-bar__item">
          {openTabs.length} {openTabs.length === 1 ? "tab" : "tabs"}
        </span>
      </footer>
    );
  }

  // Breadcrumbs info
  function renderBreadcrumbs() {
    if (location.pathname === "/") {
      return (
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <span>Roadmaps</span>
          <span className="breadcrumbs__sep">›</span>
          <span className="breadcrumbs__current">New</span>
        </nav>
      );
    }

    if (activeTab?.type === "lesson") {
      return (
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <span>Roadmaps</span>
          <span className="breadcrumbs__sep">›</span>
          <span>{activeTab.topic}</span>
          <span className="breadcrumbs__sep">›</span>
          <span className="breadcrumbs__current">{activeTab.stepTitle}</span>
        </nav>
      );
    }

    return (
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <span>Roadmaps</span>
        <span className="breadcrumbs__sep">›</span>
        <span className="breadcrumbs__current">
          {currentMatched ? currentMatched.topic : ""}
        </span>
      </nav>
    );
  }

  return (
    <div className="app">
      <Sidebar savedRoadmaps={savedRoadmaps} />

      <main className="editor">
        {/* Editor tabs */}
        <div className="editor-tabs" role="tablist">
          {openTabs.map((tab) => (
            <div
              key={tab.id}
              className={`editor-tab ${tab.id === activeTabId ? "editor-tab--active" : ""}`}
              onClick={() => handleTabClick(tab)}
              role="tab"
              tabIndex={0}
              aria-selected={tab.id === activeTabId}
              onKeyDown={(e) => e.key === "Enter" && handleTabClick(tab)}
            >
              <span className="editor-tab__icon">📄</span>
              <span className="editor-tab__label">{tab.filename}</span>
              {openTabs.length > 1 ? (
                <button
                  className="editor-tab__close"
                  onClick={(e) => handleCloseTab(tab.id, e)}
                  aria-label={`Close ${tab.filename}`}
                  type="button"
                >
                  ×
                </button>
              ) : (
                <span className="editor-tab__close-placeholder" />
              )}
            </div>
          ))}
        </div>

        {/* Breadcrumbs */}
        {renderBreadcrumbs()}

        {/* Main content via routes */}
        <div className="editor__content">
          <Routes>
            <Route
              path="/"
              element={
                <GenerateView
                  savedRoadmaps={savedRoadmaps}
                  onRoadmapGenerated={handleRoadmapGenerated}
                />
              }
            />
            <Route
              path="/roadmap/:id"
              element={
                <RoadmapRouteContainer
                  savedRoadmaps={savedRoadmaps}
                  initialLoaded={initialLoaded}
                  roadmapsCache={roadmapsCache}
                  setRoadmapsCache={setRoadmapsCache}
                  revisions={revisions}
                  loadRevisions={loadRevisions}
                  openTabs={openTabs}
                  setOpenTabs={setOpenTabs}
                  activeTabId={activeTabId}
                  setActiveTabId={setActiveTabId}
                />
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>

      {/* Status bar */}
      {renderStatusBar()}
    </div>
  );
}

export default App;
