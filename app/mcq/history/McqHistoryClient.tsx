"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import TopNav from "@/components/TopNav";
import { supabase } from "@/lib/supabase";

type Row = {
  id: string;
  mode: string;
  total_questions: number;
  correct_count: number;
  score: number;
  started_at: string;
  submitted_at: string;

  course: { id: string; code: string; name: string } | null;
  lecture: { id: string; title: string } | null;
};

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("ar-EG");
  } catch {
    return iso;
  }
}

export default function McqHistoryPage() {
  const sp = useSearchParams();
  const courseFilter = sp.get("course") ?? "";

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!courseFilter) return rows;
    return rows.filter((r) => r.course?.id === courseFilter);
  }, [rows, courseFilter]);

  useEffect(() => {
    async function load() {
      setErr(null);
      setLoading(true);

      try {
        const { data: userData, error: uErr } = await supabase.auth.getUser();
        if (uErr || !userData.user) {
          setErr("لازم تسجل دخول الأول.");
          setRows([]);
          return;
        }

        const { data, error } = await supabase
          .from("mcq_attempts")
          .select(
            `
            id,
            mode,
            total_questions,
            correct_count,
            score,
            started_at,
            submitted_at,
            course:courses(id, code, name),
            lecture:lectures(id, title)
          `
          )
          .eq("user_id", userData.user.id)
          .order("submitted_at", { ascending: false })
          .limit(200);

        if (error) {
          setErr("في مشكلة في تحميل السجل. تأكد إن جدول mcq_attempts موجود.");
          setRows([]);
          return;
        }

        setRows((data ?? []) as unknown as Row[]);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [courseFilter]);

  return (
    <AuthGuard>
      <TopNav />
      <main className="container">
        <div className="card">
          <div className="sectionHeader">
            <div className="sectionTitle">
              <h1 style={{ marginBottom: 6 }}>سجل المحاولات</h1>
              <p className="muted" style={{ marginTop: 0 }}>
                هنا هتلاقي كل اختباراتك السابقة، والنسبة/الدرجة.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <a className="btn btn--ghost" href="/mcq">
                رجوع للاختبارات
              </a>
            </div>
          </div>

          {loading ? <p className="muted">جاري التحميل…</p> : null}
          {err ? <p className="error">{err}</p> : null}
        </div>

        {!loading && !err ? (
          <div className="card" style={{ marginTop: 12 }}>
            {filtered.length === 0 ? (
              <p className="muted">مفيش محاولات لسه.</p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {filtered.map((r) => (
                  <div key={r.id} className="card card--soft">
                    <div className="sectionHeader">
                      <div className="sectionTitle" style={{ minWidth: 0 }}>
                        <div className="rowTitle">
                          {r.course ? `${r.course.code} — ${r.course.name}` : "مادة"}
                          {r.lecture ? ` • ${r.lecture.title}` : ""}
                        </div>
                        <div className="muted" style={{ fontSize: 13 }}>
                          بدأ: {fmtDate(r.started_at)} • {r.mode === "practice" ? "تدريب" : "امتحان"} • {r.total_questions} سؤال
                        </div>
                      </div>

                      <div className="kpis">
                        <span className="kpi">Score: {r.score}%</span>
                        <span className="kpi">
                          {r.correct_count}/{r.total_questions}
                        </span>
                      </div>
                    </div>

                    <div className="divider" />

                    <div className="muted" style={{ fontSize: 13 }}>
                      تسليم: {fmtDate(r.submitted_at)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </main>
    </AuthGuard>
  );
}
