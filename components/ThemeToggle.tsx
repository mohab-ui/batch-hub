"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    setMounted(true);

    // اقرأ الثيم الحالي من data-theme أو localStorage
    const saved = (localStorage.getItem("theme") as any) || null;
    const currentAttr = document.documentElement.getAttribute("data-theme") as "light" | "dark" | null;

    const initial = (currentAttr || saved || "light") as "light" | "dark";
    document.documentElement.setAttribute("data-theme", initial);
    setTheme(initial);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    setTheme(next);
  }

  if (!mounted) return null;

  return (
    <button
      type="button"
      className="iconBtn themeBtn"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation(); // ✅ يمنع أي handler فوقه يبوّظ الضغط
        toggle();
      }}
      aria-label={theme === "dark" ? "الوضع الفاتح" : "الوضع الداكن"}
      title={theme === "dark" ? "الوضع الفاتح" : "الوضع الداكن"}
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
