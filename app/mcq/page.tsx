"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import TopNav from "@/components/TopNav";
import { supabase } from "@/lib/supabase";
import { shuffle, clamp } from "@/lib/utils";

type Course = { id: string; code: string; name: string; semester: number | null };
type Lecture = { id: string; title: string; order_index: number };

type Mode = "practice" | "exam";

export default function McqStartPage() {
  const router = useRouter();
  const search = useSearchParams();

  const preCourse = search.get("course") ?? "";
  const preLecture = search.get("lecture") ?? "";

  const [courses, setCourses] = useState<Course[]>([]);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [courseId, setCourseId] = useState(preCourse);
  const [lectureId, setLectureId] = useState(preLecture);
  const [mode, setMode] = useState<Mode>("practice");
  const [count, setCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    async function loadCourses() {
      const { data, error } = await supabase
        .from("courses")
        .select("id, code, name, semester")
        .order("semester", { ascending: true })
        .order("code", { ascending: true });

      if (error) {
        setErr("مش قادر أجيب قائمة المواد.");
        return;
      }
      setCourses((data ?? []) as Course[]);
    }
    loadCourses();
  }, []);

  useEffect(() => {
    async function loadLectures() {
      setLectures([]);
      if (!courseId) return;
      const { data, error } = await supabase
        .from("lectures")
        .select("id, title, order_index")
        .eq("course_id", courseId)
        .order("order_index", { ascending: true });

      if (error) return;
      setLectures((data ?? []) as Lecture[]);
    }
    loadLectures();
  }, [courseId]);

  const selectedCourse = useMemo(() => courses.find((c) => c.id === courseId) ?? null, [courses, courseId]);
  const selectedLecture = useMemo(() => lectures.find((l) => l.id === lectureId) ?? null, [lectures, lectureId]);

  async function start() {
    setErr(null);
    setInfo(null);

    if (!courseId) {
      setErr("اختار المادة الأول.");
      return;
    }

    const n = clamp(Number(count) || 10, 1, 100);

    setLoading(true);
    try {
      const { data: userData, error: uErr } = await supabase.auth.getUser();
      if (uErr || !userData.user) {
        setErr("لازم تسجل دخول.");
        return;
      }

      // 1) Fetch question IDs (filter by course + lecture optional)
      let qQuery = supabase
        .from("mcq_questions")
        .select("id")
        .eq("course_id", courseId)
        .limit(500);

      if (lectureId && lectureId !== "__all__") {
        // Include lecture-specific questions + general (lecture_id is null)
        qQuery = qQuery.or(`lecture_id.eq.${lectureId},lecture_id.is.null`);
      }

      const { data: qData, error: qErr } = await qQuery;
      if (qErr) {
        setErr("مش قادر أجيب بنك الأسئلة. تأكد إنك شغّلت Migration بتاع MCQ.");
        return;
      }

      const ids = (qData ?? []).map((x: any) => x.id as string);
      if (ids.length === 0) {
        setErr("مفيش أسئلة متاحة للفلتر ده. اطلب من المشرف يضيف أسئلة للمادة/المحاضرة.");
        return;
      }

      const picked = shuffle(ids).slice(0, Math.min(n, ids.length));
      if (picked.length < n) {
        setInfo(`متاح ${ids.length} سؤال بس — هنعمل اختبار بـ ${picked.length} سؤال.`);
      }

      // 2) Create quiz row
      const { data: quizRow, error: quizErr } = await supabase
        .from("mcq_quizzes")
        .insert({
          user_id: userData.user.id,
          course_id: courseId,
          lecture_id: lectureId && lectureId !== "__all__" ? lectureId : null,
          mode,
          total_questions: picked.length,
          correct_count: 0,
          score: 0,
        })
        .select("id")
        .single();

      if (quizErr || !quizRow) {
        setErr("مشكلة في إنشاء الاختبار.");
        return;
      }

      const quizId = (quizRow as any).id as string;

      // 3) Insert quiz questions
      const rows = picked.map((qid, i) => ({ quiz_id: quizId, question_id: qid, order_index: i }));
      const { error: qqErr } = await supabase.from("mcq_quiz_questions").insert(rows);
      if (qqErr) {
        setErr("مشكلة في تجهيز أسئلة الاختبار.");
        return;
      }

      router.push(`/mcq/quiz/${quizId}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthGuard>
      <TopNav />
      <main className="container">
        <div className="card">
          <div className="sectionHeader">
            <div className="sectionTitle">
              <h1 style={{ marginBottom: 6 }}>اختبر نفسك (MCQs)</h1>
              <p className="muted" style={{ marginTop: 0 }}>
                اختار المادة (والمحاضرة لو حابب) وحدد عدد الأسئلة. النتيجة هتتحفظ في حسابك.
              </p>
            </div>

            <div className="kpis">
              <a className="btn btn--ghost" href="/mcq/history">محاولاتي السابقة</a>
            </div>
          </div>

          <div className="grid" style={{ marginTop: 12 }}>
            <div className="col-12 col-6">
              <label className="label">المادة</label>
              <select className="select" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                <option value="">اختر مادة…</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-12 col-6">
              <label className="label">المحاضرة (اختياري)</label>
              <select
                className="select"
                value={lectureId || "__all__"}
                onChange={(e) => setLectureId(e.target.value === "__all__" ? "" : e.target.value)}
                disabled={!courseId}
              >
                <option value="__all__">الكل</option>
                {lectures.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </select>
              {!courseId ? <p className="muted" style={{ marginTop: 6 }}>اختر مادة علشان تظهر المحاضرات.</p> : null}
            </div>

            <div className="col-12 col-6">
              <label className="label">وضع الاختبار</label>
              <select className="select" value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
                <option value="practice">تدريب (يعرض صح/غلط فورًا)</option>
                <option value="exam">امتحان (النتيجة بعد التسليم)</option>
              </select>
            </div>

            <div className="col-12 col-6">
              <label className="label">عدد الأسئلة</label>
              <input
                className="input"
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                type="number"
                min={1}
                max={100}
                placeholder="مثال: 10"
              />
            </div>
          </div>

          {selectedCourse ? (
            <div style={{ marginTop: 12 }} className="note">
              <div className="note__title">اختيارك الحالي</div>
              <div className="note__body">
                {selectedCourse.code} — {selectedCourse.name}
                {selectedLecture ? ` • ${selectedLecture.title}` : lectureId ? "" : " • الكل"}
                {` • ${mode === "practice" ? "تدريب" : "امتحان"} • ${clamp(Number(count) || 10, 1, 100)} سؤال`}
              </div>
            </div>
          ) : null}

          {info ? <p className="muted" style={{ marginTop: 10 }}>{info}</p> : null}
          {err ? <p className="error" style={{ marginTop: 10 }}>{err}</p> : null}

          <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn" onClick={start} disabled={loading}>
              {loading ? "جاري تجهيز الاختبار…" : "ابدأ الاختبار"}
            </button>
            <a className="btn btn--ghost" href="/dashboard">رجوع للمواد</a>
          </div>
        </div>

        <div className="card card--soft" style={{ marginTop: 12 }}>
          <h2 style={{ marginBottom: 8 }}>نصيحة تنظيم</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            لو بنك الأسئلة كبير: خلي الأسئلة مرتبطة بـ “محاضرة” علشان الاختبارات تبقى أدق.
            ولو سؤال عام للمادة كلها، خليه من غير محاضرة.
          </p>
        </div>
      </main>
    </AuthGuard>
  );
}
