"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

function applyTheme(theme: Theme) {
  const prefersDark =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  const isDark = theme === "dark" || (theme === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.dataset.theme = theme;

  try {
    localStorage.setItem("theme", theme);
  } catch {}
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    const stored = (localStorage.getItem("theme") as Theme) || "system";
    setTheme(stored);

    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onChange = () => {
      const current = (document.documentElement.dataset.theme as Theme) || stored;
      if (current === "system") applyTheme("system");
    };
    mq?.addEventListener?.("change", onChange);
    return () => mq?.removeEventListener?.("change", onChange);
  }, []);

  function cycle() {
    const next: Theme = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
    setTheme(next);
    applyTheme(next);
  }

  const label = theme === "system" ? "System" : theme === "light" ? "Light" : "Dark";
  const icon = theme === "dark" ? "🌙" : theme === "light" ? "☀️" : "🖥️";

  return (
    <button className="btn btn--ghost" onClick={cycle} title="Theme">
      <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
        <span aria-hidden>{icon}</span>
        <span style={{ fontSize: 13 }}>{label}</span>
      </span>
    </button>
  );
}
