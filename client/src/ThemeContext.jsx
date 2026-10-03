import { createContext, useContext, useState, useEffect, useCallback } from "react";

const ThemeContext = createContext();

function getInitialTheme() {
  try {
    const saved = localStorage.getItem("ql-theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch {}

  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return "dark";
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);
  const [hasExplicitChoice, setHasExplicitChoice] = useState(() => {
    try {
      return localStorage.getItem("ql-theme") !== null;
    } catch {
      return false;
    }
  });

  const applyTheme = useCallback((newTheme) => {
    document.documentElement.dataset.theme = newTheme;
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme, applyTheme]);

  // Listen to OS preference if user hasn't chosen explicitly
  useEffect(() => {
    if (hasExplicitChoice || typeof window === "undefined" || !window.matchMedia) return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e) => {
      try {
        if (!localStorage.getItem("ql-theme")) {
          const nextTheme = e.matches ? "dark" : "light";
          setTheme(nextTheme);
          applyTheme(nextTheme);
        }
      } catch {}
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [hasExplicitChoice, applyTheme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem("ql-theme", next);
      } catch {}
      setHasExplicitChoice(true);
      applyTheme(next);
      return next;
    });
  }, [applyTheme]);

  // Keyboard shortcut Ctrl/Cmd + Shift + L
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "L" || e.key === "l")) {
        e.preventDefault();
        toggleTheme();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleTheme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
