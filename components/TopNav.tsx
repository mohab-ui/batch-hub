"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getMyProfile, isModerator, UserRole } from "@/lib/profile";
import ThemeToggle from "@/app/ThemeToggle";

function roleLabel(role: UserRole | null) {
  if (role === "admin") return "Admin";
  if (role === "moderator") return "مشرف";
  if (role === "student") return "طالب";
  return "...";
}

export default function TopNav() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole | null>(null);
  const [open, setOpen] = useState(false);

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

        {/* ✅ NAV: على الديسكتوب ظاهر عادي — وعلى الموبايل Dropdown */}
        <nav className={`topnav__links ${open ? "isOpen" : ""}`}>
          <Link className="navLink" href="/dashboard" onClick={() => setOpen(false)}>
            المواد
          </Link>
          <Link className="navLink" href="/mcq" onClick={() => setOpen(false)}>
            اختبارات MCQ
          </Link>

          {canManage ? (
            <>
              <Link className="navLink" href="/upload" onClick={() => setOpen(false)}>
                رفع محتوى
              </Link>
              <Link className="navLink" href="/admin/courses" onClick={() => setOpen(false)}>
                إدارة المواد
              </Link>
              <Link className="navLink" href="/admin/mcq" onClick={() => setOpen(false)}>
                إدارة الأسئلة
              </Link>
            </>
          ) : null}

          {/* ✅ زرار الثيم يظهر جنب اللينكات على اللاب */}
          <span className="themeDesktop">
            <ThemeToggle />
          </span>

          <span className="chip" title="الدور الحالي">
            👤 {roleLabel(role)}
          </span>

          <button className="btn btn--ghost" onClick={logout} type="button">
            تسجيل خروج
          </button>
        </nav>

        {/* ✅ Actions: على الموبايل الزرار يظهر برا الهمبرجر */}
        <div className="topnav__actions">
          <span className="themeMobile">
            <ThemeToggle />
          </span>

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
      </div>
    </header>
  );
}
