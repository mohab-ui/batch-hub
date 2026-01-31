"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import TopNav from "@/components/TopNav";
import { supabase } from "@/lib/supabase";
import { fmtDate, pct } from "@/lib/utils";

type Row = {
  id: string;
  mode: "practice" | "exam";
  total_questions: number;
  correct_count: number;
  score: number;
  started_at: string;
  submitted_at: string | null;
  course: { id: string; code: string; name: string } | null;
  lecture: { id: string; title: string } | null;
};

export default function McqHistoryPage() {
  const search = useSearchParams();
  const courseFilter = search.get("course") ?? "";

  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setErr(null);
      let q = supabase
        .from("mcq_quizzes")
        .select(
          "id, mode, total_questions, correct_count, score, started_at, submitted_at, course:courses(id,code,name), lecture:lectures(id,title)"
        )
        .order("started_at", { ascending: false })
        .limit(200);

      if (courseFilter) q = q.eq("course_id", courseFilter);

      const { data, error } = await q;
      if (error) {
        setErr("مش قادر أجيب محاولاتك السابقة.");
        return;
      }
      setRows((data ?? []) as Row[]);
    }
    load();
  }, [courseFilter]);

  const submitted = useMemo(() => rows.filter((r) => r.submitted_at), [rows]);
  const inProgress = useMemo(() => rows.filter((r) => !r.submitted_at), [rows]);

  return (
    <AuthGuard>
      <TopNav />
      <main className="container">
        <div className="card">
          <div className="sectionHeader">
            <div className="sectionTitle">
              <h1 style={{ marginBottom: 6 }}>محاولاتي السابقة</h1>
              <p className="muted" style={{ marginTop: 0 }}>
                تقدر تفتح نتيجة أي محاولة أو تكمّل محاولة لسه ما اتسلمتش.
              </p>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link className="btn" href="/mcq">اختبار جديد</Link>
              <Link className="btn btn--ghost" href="/dashboard">المواد</Link>
            </div>
          </div>

          {err ? <p className="error">{err}</p> : null}
        </div>

        {inProgress.length ? (
          <div className="card" style={{ marginTop: 12 }}>
            <h2 style={{ marginBottom: 8 }}>محاولات لم تُسلّم</h2>
            <div style={{ display: "grid", gap: 10 }}>
              {inProgress.map((r) => (
                <div key={r.id} className="rowItem">
                  <div style={{ minWidth: 0 }}>
                    <div className="rowTitle">
                      {r.course ? `${r.course.code} — ${r.course.name}` : "مادة"}
                      {r.lecture ? ` • ${r.lecture.title}` : ""}
                    </div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      بدأ: {fmtDate(r.started_at)} • {r.mode === "practice" ? "تدريب" : "امتحان"} • {r.total_questions} سؤال
                    </div>
                  </div>
                  <Link className="btn btn--ghost" href={`/mcq/quiz/${r.id}`}>
                    كمّل
                  </Link>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="card" style={{ marginTop: 12 }}>
          <h2 style={{ marginBottom: 8 }}>محاولات مُسلّمة</h2>

          {submitted.length === 0 ? (
            <p className="muted">لسه مفيش محاولات مسلّمة.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {submitted.map((r) => (
                <div key={r.id} className="rowItem">
                  <div style={{ minWidth: 0 }}>
                    <div className="rowTitle">
                      {r.course ? `${r.course.code} — ${r.course.name}` : "مادة"}
                      {r.lecture ? ` • ${r.lecture.title}` : ""}
                    </div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      {fmtDate(r.submitted_at)} • {r.mode === "practice" ? "تدريب" : "امتحان"} •{" "}
                      {r.correct_count}/{r.total_questions} ({pct(r.correct_count, r.total_questions)}%)
                    </div>
                  </div>

                  <Link className="btn" href={`/mcq/results/${r.id}`}>
                    النتيجة
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </AuthGuard>
  );
}
