"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getMyProfile, isModerator, UserRole } from "@/lib/profile";

function roleLabel(role: UserRole | null) {
  if (role === "admin") return "Admin";
  if (role === "moderator") return "مشرف";
  if (role === "student") return "طالب";
  return "...";
}

type Theme = "dark" | "light";

export default function TopNav() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole | null>(null);
  const [open, setOpen] = useState(false);

  // ===== Theme =====
  const [theme, setTheme] = useState<Theme>("dark");
  const isDark = theme === "dark";

  useEffect(() => {
    // load theme from localStorage
    try {
      const saved = localStorage.getItem("theme") as Theme | null;
      if (saved === "light" || saved === "dark") setTheme(saved);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    // apply theme class on <html>
    const root = document.documentElement;
    root.classList.remove("theme-dark", "theme-light");
    root.classList.add(isDark ? "theme-dark" : "theme-light");

    // optionally help form controls
    root.style.colorScheme = isDark ? "dark" : "light";

    try {
      localStorage.setItem("theme", theme);
    } catch {
      // ignore
    }
  }, [theme, isDark]);

  function toggleTheme() {
    setTheme((p) => (p === "dark" ? "light" : "dark"));
  }

  // ===== Profile / Role =====
  useEffect(() => {
    let mounted = true;
    getMyProfile().then((p) => {
      if (!mounted) return;
      setRole(p?.role ?? null);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const canManage = useMemo(() => isModerator(role as any), [role]);

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <header className="topnav">
      <div className="container topnav__inner">
        <Link className="brand" href="/dashboard" title="العودة للمواد">
          <span className="brand__dot" aria-hidden />
          دفعتنا
        </Link>

        {/* أدوات يمين: زر الثيم + زر القائمة للموبايل */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            className="iconBtn"
            onClick={toggleTheme}
            aria-label={isDark ? "تحويل للوضع الفاتح" : "تحويل للوضع الداكن"}
            title={isDark ? "Light Mode" : "Dark Mode"}
            type="button"
          >
            {isDark ? "☀️" : "🌙"}
          </button>

          <button
            className="iconBtn navToggle"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "إغلاق القائمة" : "فتح القائمة"}
            aria-expanded={open}
            type="button"
          >
            {open ? "✕" : "☰"}
          </button>
        </div>

        <nav
          className={`topnav__links ${open ? "isOpen" : ""}`}
          onClick={() => setOpen(false)}
        >
          <Link className="navLink" href="/dashboard">
            المواد
          </Link>
          <Link className="navLink" href="/mcq">
            اختبارات MCQ
          </Link>

          {canManage ? (
            <>
              <Link className="navLink" href="/upload">
                رفع محتوى
              </Link>
              <Link className="navLink" href="/admin/courses">
                إدارة المواد
              </Link>
              <Link className="navLink" href="/admin/mcq">
                إدارة الأسئلة
              </Link>
            </>
          ) : null}

          <span className="chip" title="الدور الحالي">
            👤 {roleLabel(role)}
          </span>

          <button className="btn btn--ghost" onClick={logout} type="button">
            تسجيل خروج
          </button>
        </nav>
      </div>
    </header>
  );
}
