"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import TopNav from "@/components/TopNav";
import ResourceCard, { Resource } from "@/components/ResourceCard";
import { supabase } from "@/lib/supabase";
import { getMyProfile, isModerator, UserRole } from "@/lib/profile";
import { pct } from "@/lib/utils";

type Course = {
  id: string;
  code: string;
  name: string;
  semester: number | null;
  description: string | null;
};

type Lecture = {
  id: string;
  title: string;
  order_index: number;
};

const TYPES = ["كتاب", "ملخص", "سلايدات", "امتحان سابق", "أسئلة", "ريكورد", "لينك"];

const GROUPS: Array<{ key: string; title: string; emoji: string; types: string[] }> = [
  { key: "files", title: "ملفات", emoji: "📁", types: ["كتاب", "ملخص", "سلايدات", "امتحان سابق"] },
  { key: "questions", title: "أسئلة", emoji: "❓", types: ["أسئلة"] },
  { key: "records", title: "ريكوردات", emoji: "🎧", types: ["ريكورد"] },
  { key: "links", title: "لينكات", emoji: "🔗", types: ["لينك"] },
];

function countByType(list: Resource[]) {
  const m: Record<string, number> = {};
  for (const r of list) m[r.type] = (m[r.type] ?? 0) + 1;
  return m;
}

export default function CoursePage() {
  const params = useParams<{ courseId: string }>();
  const searchParams = useSearchParams();
  const courseId = params.courseId;

  const preselectLecture = searchParams.get("lecture");

  const [role, setRole] = useState<UserRole | null>(null);

  const [course, setCourse] = useState<Course | null>(null);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [q, setQ] = useState("");
  const [type, setType] = useState<string>("الكل");
  const [activeLectureId, setActiveLectureId] = useState<string>(preselectLecture ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [mcqStats, setMcqStats] = useState<{ attempts: number; lastPct: number; lastLabel: string; bestPct: number; avgPct: number } | null>(null);

  useEffect(() => {
    async function load() {
      setErr(null);

      const profile = await getMyProfile();
      setRole(profile?.role ?? null);

      const { data: cData, error: cErr } = await supabase
        .from("courses")
        .select("id, code, name, semester, description")
        .eq("id", courseId)
        .single();

      if (cErr) {
        setErr("مش قادر أجيب بيانات المادة.");
        return;
      }
      setCourse(cData as Course);

      const { data: lData } = await supabase
        .from("lectures")
        .select("id, title, order_index")
        .eq("course_id", courseId)
        .order("order_index", { ascending: true });

      setLectures((lData ?? []) as Lecture[]);

      const { data: rData, error: rErr } = await supabase
        .from("resources")
        .select("id, lecture_id, title, type, description, storage_path, external_url, created_at")
        .eq("course_id", courseId)
        .order("created_at", { ascending: false });

      if (rErr) {
        setErr("مش قادر أجيب ملفات المادة.");
        return;
      }
      setResources((rData ?? []) as Resource[]);

      // MCQ stats for this course (optional)
      try {
        if (profile?.id) {
          const { data: quizData, error: quizErr } = await supabase
            .from("mcq_quizzes")
            .select("id, correct_count, total_questions, submitted_at")
            .eq("user_id", profile.id)
            .eq("course_id", courseId)
            .not("submitted_at", "is", null)
            .order("submitted_at", { ascending: false })
            .limit(120);

          if (!quizErr && quizData && quizData.length) {
            let attempts = 0;
            let bestPct = 0;
            let sum = 0;

            const first = quizData[0] as any;
            const lastPct = pct(first.correct_count ?? 0, first.total_questions ?? 0);
            const lastLabel = `${first.correct_count}/${first.total_questions}`;

            for (const row of quizData as any[]) {
              const p = pct(row.correct_count ?? 0, row.total_questions ?? 0);
              attempts += 1;
              bestPct = Math.max(bestPct, p);
              sum += p;
            }

            const avgPct = Math.round(sum / Math.max(1, attempts));
            setMcqStats({ attempts, lastPct, lastLabel, bestPct, avgPct });
          } else {
            setMcqStats(null);
          }
        }
      } catch {
        setMcqStats(null);
      }
    }

    load();
  }, [courseId]);

  // If lecture is preselected from URL, respect it
  useEffect(() => {
    if (preselectLecture) setActiveLectureId(preselectLecture);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectLecture]);

  const filteredResources = useMemo(() => {
    const term = q.trim().toLowerCase();
    return resources.filter((r) => {
      const matchesType = type === "الكل" ? true : r.type === type;
      const hay = `${r.title} ${r.description ?? ""}`.toLowerCase();
      const matchesText = term ? hay.includes(term) : true;
      return matchesType && matchesText;
    });
  }, [resources, q, type]);

  const byLecture = useMemo(() => {
    const map = new Map<string, Resource[]>();
    const ungrouped: Resource[] = [];
    for (const r of filteredResources) {
      const lid = (r as any).lecture_id as string | null | undefined;
      if (!lid) {
        ungrouped.push(r);
        continue;
      }
      if (!map.has(lid)) map.set(lid, []);
      map.get(lid)!.push(r);
    }
    return { map, ungrouped };
  }, [filteredResources]);

  const canManage = useMemo(() => isModerator(role as any), [role]);

  const lectureListForSidebar = useMemo(() => {
    // Add “ungrouped” pseudo lecture if exists
    const list: Array<{ id: string; title: string; count: number }> = [];

    list.push({ id: "__all__", title: "الكل", count: filteredResources.length });

    for (const l of lectures) {
      const c = byLecture.map.get(l.id)?.length ?? 0;
      list.push({ id: l.id, title: l.title, count: c });
    }

    if (byLecture.ungrouped.length) {
      list.push({ id: "__ungrouped__", title: "محتوى عام", count: byLecture.ungrouped.length });
    }

    return list;
  }, [lectures, byLecture, filteredResources.length]);

  const visibleLectureIds = useMemo(() => {
    if (!activeLectureId || activeLectureId === "__all__") return lectures.map((l) => l.id);
    if (activeLectureId === "__ungrouped__") return ["__ungrouped__"];
    return [activeLectureId];
  }, [activeLectureId, lectures]);

  return (
    <AuthGuard>
      <TopNav />
      <main className="container">
        <div className="card">
          <div className="sectionHeader">
            <div className="sectionTitle" style={{ minWidth: 0 }}>
              <div>
                <h1 style={{ marginBottom: 6 }}>
                  {course ? `${course.code} — ${course.name}` : "المادة"}
                </h1>
                {course?.description ? <p className="muted">{course.description}</p> : null}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link
                className="btn"
                href={`/mcq?course=${courseId}${
                  activeLectureId &&
                  activeLectureId !== "__all__" &&
                  activeLectureId !== "__ungrouped__"
                    ? `&lecture=${activeLectureId}`
                    : ""
                }`}
              >
                اختبر نفسك (MCQ)
              </Link>
              <Link className="btn btn--ghost" href={`/mcq/history?course=${courseId}`}>
                نتائجي
              </Link>

              {canManage ? (
                <>
                  <Link className="btn btn--ghost" href={`/admin/courses/${courseId}/lectures`}>
                    إدارة المحاضرات
                  </Link>
                  <Link className="btn btn--ghost" href="/upload">
                    رفع محتوى
                  </Link>
                </>
              ) : null}
            </div>
          </div>

          <div className="grid" style={{ marginTop: 12 }}>
            <div className="col-12 col-6">
              <label className="label">بحث</label>
              <input
                className="input"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ابحث في العناوين/الوصف…"
              />
            </div>
            <div className="col-12 col-6">
              <label className="label">نوع المحتوى</label>
              <select
                className="select"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="الكل">الكل</option>
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {err ? <p className="error">{err}</p> : null}
          {mcqStats ? (
            <div className="note" style={{ marginTop: 12 }}>
              <div className="note__title">ملخص نتائج MCQ للمادة</div>
              <div className="note__body">
                آخر نتيجة: <b>{mcqStats.lastPct}%</b> ({mcqStats.lastLabel}) — أفضل:{" "}
                <b>{mcqStats.bestPct}%</b> — متوسط: <b>{mcqStats.avgPct}%</b> — محاولات:{" "}
                <b>{mcqStats.attempts}</b>
              </div>
            </div>
          ) : (
            <p className="muted" style={{ marginTop: 12 }}>
              مفيش نتائج MCQ للمادة دي لسه.
            </p>
          )}

        </div>

        <div className="layout">
          <aside className="sidebar">
            <div className="card card--soft">
              <h2 style={{ marginBottom: 8 }}>التقسيم</h2>
              <p className="muted" style={{ marginTop: 0 }}>
                اختار محاضرة علشان تعرض محتواها فقط.
              </p>

              <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                {lectureListForSidebar.map((item) => (
                  <button
                    key={item.id}
                    className="accordionBtn"
                    onClick={() => setActiveLectureId(item.id)}
                    style={{
                      borderColor:
                        activeLectureId === item.id ? "rgba(106,169,255,.9)" : undefined,
                    }}
                  >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.title}
                    </span>
                    <span className="kpi">{item.count}</span>
                  </button>
                ))}
              </div>

              <div className="divider" />
              <p className="muted" style={{ marginTop: 0 }}>
                {filteredResources.length
                  ? `نتائج مطابقة: ${filteredResources.length}`
                  : "مفيش نتائج مطابقة."}
              </p>
            </div>
          </aside>

          <section style={{ display: "grid", gap: 12 }}>
            {/* Ungrouped */}
            {visibleLectureIds.includes("__ungrouped__") ? (
              <div className="card">
                <div className="sectionHeader">
                  <div className="sectionTitle">
                    <h2>محتوى عام</h2>
                  </div>
                  <div className="kpis">
                    <span className="kpi">{byLecture.ungrouped.length} عنصر</span>
                  </div>
                </div>

                <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                  {byLecture.ungrouped.map((r) => (
                    <ResourceCard key={r.id} r={r} />
                  ))}
                  {byLecture.ungrouped.length === 0 ? (
                    <p className="muted">مفيش محتوى هنا.</p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* Lectures */}
            {visibleLectureIds
              .filter((id) => id !== "__ungrouped__")
              .map((lid) => {
                const lecture = lectures.find((l) => l.id === lid);
                if (!lecture) return null;

                const list = byLecture.map.get(lecture.id) ?? [];
                const counts = countByType(list);

                return (
                  <div key={lecture.id} className="card">
                    <div className="sectionHeader">
                      <div className="sectionTitle">
                        <h2>{lecture.title}</h2>
                      </div>

                      <div className="kpis">
                        <span className="kpi">{list.length} عنصر</span>
                        {Object.entries(counts)
                          .slice(0, 3)
                          .map(([t, c]) => (
                            <span key={t} className="kpi">
                              {t}: {c}
                            </span>
                          ))}
                      </div>
                    </div>

                    <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                      {GROUPS.map((g) => {
                        const sub = list.filter((r) => g.types.includes(r.type));
                        if (sub.length === 0) return null;

                        return (
                          <div key={g.key}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span className="chip">
                                {g.emoji} {g.title}
                              </span>
                              <span className="muted" style={{ fontSize: 13 }}>
                                {sub.length} عنصر
                              </span>
                            </div>

                            <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
                              {sub.map((r) => (
                                <ResourceCard key={r.id} r={r} />
                              ))}
                            </div>

                            <div className="divider" />
                          </div>
                        );
                      })}

                      {/* Any types not covered in groups */}
                      {(() => {
                        const covered = new Set(GROUPS.flatMap((g) => g.types));
                        const rest = list.filter((r) => !covered.has(r.type));
                        if (rest.length === 0) return null;
                        return (
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span className="chip">📦 أخرى</span>
                              <span className="muted" style={{ fontSize: 13 }}>
                                {rest.length} عنصر
                              </span>
                            </div>
                            <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
                              {rest.map((r) => (
                                <ResourceCard key={r.id} r={r} />
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {list.length === 0 ? (
                        <p className="muted">مفيش محتوى هنا لسه… أو مفيش نتائج للفلتر.</p>
                      ) : null}
                    </div>
                  </div>
                );
              })}

            {lectures.length === 0 && !err ? (
              <div className="card">
                <h2>مفيش محاضرات لسه</h2>
                <p className="muted">
                  علشان تنظّم المحتوى جوا المادة، اضف محاضرات من صفحة الإدارة.
                </p>
                {canManage ? (
                  <Link className="btn" href={`/admin/courses/${courseId}/lectures`}>
                    إضافة محاضرات
                  </Link>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </AuthGuard>
  );
}
