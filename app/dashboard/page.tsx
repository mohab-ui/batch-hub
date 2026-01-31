"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import TopNav from "@/components/TopNav";
import { supabase } from "@/lib/supabase";
import { pct } from "@/lib/utils";

type Course = {
  id: string;
  code: string;
  name: string;
  semester: number | null;
  description: string | null;
};

type QuizMini = {
  course_id: string;
  correct_count: number;
  total_questions: number;
  submitted_at: string | null;
};

type CourseStats = {
  attempts: number;
  lastPct: number;
  lastLabel: string;
  bestPct: number;
  avgPct: number;
};

export default function DashboardPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const [statsByCourse, setStatsByCourse] = useState<Record<string, CourseStats>>({});
  const [statsErr, setStatsErr] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setErr(null);

      const { data: cData, error: cErr } = await supabase
        .from("courses")
        .select("id, code, name, semester, description")
        .order("semester", { ascending: true })
        .order("code", { ascending: true });

      if (cErr) {
        setErr("مش قادر أجيب قائمة المواد. تأكد من الـ RLS والسياسات.");
        return;
      }
      setCourses((cData ?? []) as Course[]);

      // MCQ stats (optional if migration not applied yet)
      try {
        setStatsErr(null);
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData.user?.id;
        if (!uid) return;

        const { data: qz, error: qzErr } = await supabase
          .from("mcq_quizzes")
          .select("course_id, correct_count, total_questions, submitted_at")
          .eq("user_id", uid)
          .not("submitted_at", "is", null)
          .order("submitted_at", { ascending: false })
          .limit(400);

        if (qzErr) {
          // Migration might not exist yet, or policies not set. Ignore but show message lightly.
          setStatsErr("ملخص MCQ غير متاح (تأكد من تشغيل Migration).");
          return;
        }

        const list = (qz ?? []) as QuizMini[];
        const map: Record<string, CourseStats> = {};

        for (const row of list) {
          const cid = row.course_id;
          const p = pct(row.correct_count ?? 0, row.total_questions ?? 0);

          if (!map[cid]) {
            map[cid] = {
              attempts: 0,
              lastPct: p,
              lastLabel: `${row.correct_count}/${row.total_questions}`,
              bestPct: p,
              avgPct: 0,
            };
          }

          map[cid].attempts += 1;
          map[cid].bestPct = Math.max(map[cid].bestPct, p);

          // Keep last as first (because ordered desc)
          if (map[cid].attempts === 1) {
            map[cid].lastPct = p;
            map[cid].lastLabel = `${row.correct_count}/${row.total_questions}`;
          }

          map[cid].avgPct += p;
        }

        for (const cid of Object.keys(map)) {
          map[cid].avgPct = Math.round(map[cid].avgPct / Math.max(1, map[cid].attempts));
        }

        setStatsByCourse(map);
      } catch {
        // ignore
      }
    }

    load();
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return courses;
    return courses.filter((c) => {
      const hay = `${c.code} ${c.name} ${c.description ?? ""}`.toLowerCase();
      return hay.includes(term);
    });
  }, [courses, q]);

  const totalAttempts = useMemo(() => {
    return Object.values(statsByCourse).reduce((sum, s) => sum + s.attempts, 0);
  }, [statsByCourse]);

  return (
    <AuthGuard>
      <TopNav />
      <main className="container">
        <div className="card">
          <div className="sectionHeader">
            <div className="sectionTitle">
              <h1>المواد</h1>
              <p className="muted" style={{ marginTop: 0 }}>
                اختار المادة علشان تشوف الملفات المرتبطة بيها. استخدم البحث لو القائمة طويلة.
              </p>
            </div>

            <div className="kpis">
              <Link className="btn" href="/mcq">اختبار جديد</Link>
              <Link className="btn btn--ghost" href="/mcq/history">محاولاتي</Link>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <input
              className="input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث باسم المادة أو الكود…"
            />
          </div>

          {err ? <p className="error">{err}</p> : null}

          {Object.keys(statsByCourse).length ? (
            <div className="note" style={{ marginTop: 12 }}>
              <div className="note__title">ملخص MCQ</div>
              <div className="note__body">
                إجمالي المحاولات المسلّمة: <b>{totalAttempts}</b> — افتح مادة علشان تشوف الملخص بتاعها.
              </div>
            </div>
          ) : statsErr ? (
            <p className="muted" style={{ marginTop: 12 }}>{statsErr}</p>
          ) : null}
        </div>

        <div className="grid" style={{ marginTop: 12 }}>
          {filtered.map((c) => {
            const s = statsByCourse[c.id];

            return (
              <div key={c.id} className="col-12 col-6">
                <div className="card">
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <h2 style={{ marginBottom: 6 }}>
                        {c.code} — {c.name}
                      </h2>
                      <div className="pill">{c.semester ? `ترم ${c.semester}` : "بدون ترم"}</div>
                      {c.description ? (
                        <p className="muted" style={{ marginTop: 10 }}>
                          {c.description}
                        </p>
                      ) : null}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
                      <Link className="btn" href={`/courses/${c.id}`}>الملفات</Link>
                      <Link className="btn btn--ghost" href={`/mcq?course=${c.id}`}>MCQ</Link>
                    </div>
                  </div>

                  {s ? (
                    <div className="miniStats" style={{ marginTop: 12 }}>
                      <div className="miniStats__item">
                        <div className="miniStats__label">آخر نتيجة</div>
                        <div className="miniStats__value">{s.lastPct}%</div>
                        <div className="miniStats__sub">{s.lastLabel}</div>
                      </div>
                      <div className="miniStats__item">
                        <div className="miniStats__label">أفضل</div>
                        <div className="miniStats__value">{s.bestPct}%</div>
                        <div className="miniStats__sub">{s.attempts} محاولة</div>
                      </div>
                      <div className="miniStats__item">
                        <div className="miniStats__label">متوسط</div>
                        <div className="miniStats__value">{s.avgPct}%</div>
                        <div className="miniStats__sub">—</div>
                      </div>
                    </div>
                  ) : (
                    <p className="muted" style={{ marginTop: 12 }}>
                      مفيش نتائج MCQ للمادة دي لسه.
                    </p>
                  )}
                </div>
              </div>
            );
          })}

          {filtered.length === 0 ? (
            <div className="col-12 card">
              <p className="muted">مفيش نتائج مطابقة.</p>
            </div>
          ) : null}
        </div>

        <p className="muted" style={{ marginTop: 12 }}>
          جميع حقوق الطبع والنشر محفوظة
        </p>
      </main>
    </AuthGuard>
  );
}
