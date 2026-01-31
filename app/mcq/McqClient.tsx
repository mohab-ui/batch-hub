"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import TopNav from "@/components/TopNav";
import { supabase } from "@/lib/supabase";

type Course = { id: string; code: string; name: string };
type Lecture = { id: string; title: string; order_index: number };

type McqQuestion = {
  id: string;
  question_text: string;
  choices: string[];
  correct_index: number;
  explanation: string | null;
  course_id: string;
  lecture_id: string | null;
};

function letterFromIndex(i: number) {
  return ["A", "B", "C", "D", "E"][i] ?? String(i + 1);
}

export default function McqPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const [courses, setCourses] = useState<Course[]>([]);
  const [lectures, setLectures] = useState<Lecture[]>([]);

  const [courseId, setCourseId] = useState<string>(sp.get("course") ?? "");
  const [lectureId, setLectureId] = useState<string>(sp.get("lecture") ?? "");
  const [mode, setMode] = useState<"practice" | "exam">(
    (sp.get("mode") as any) === "exam" ? "exam" : "practice"
  );

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [questions, setQuestions] = useState<McqQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const [quizId, setQuizId] = useState<string | null>(null);

  const current = questions[idx];

  useEffect(() => {
    async function loadCourses() {
      const { data, error } = await supabase
        .from("courses")
        .select("id, code, name")
        .order("code", { ascending: true });

      if (error) return;
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

  const canStart = useMemo(() => !!courseId, [courseId]);

  async function start() {
    setErr(null);
    setLoading(true);
    setSubmitted(false);
    setIdx(0);
    setAnswers({});
    setQuestions([]);
    setQuizId(null);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setErr("لازم تسجل دخول الأول.");
        return;
      }

      if (!courseId) {
        setErr("اختار المادة الأول.");
        return;
      }

      let q = supabase
        .from("mcq_questions")
        .select("id, question_text, choices, correct_index, explanation, course_id, lecture_id")
        .eq("course_id", courseId);

      if (lectureId) q = q.eq("lecture_id", lectureId);

      const { data, error } = await q.limit(50);

      if (error) {
        setErr("في مشكلة في تحميل الأسئلة.");
        return;
      }

      const list = (data ?? []) as McqQuestion[];
      if (!list.length) {
        setErr("مفيش أسئلة متاحة للفلتر ده.");
        return;
      }

      list.sort(() => Math.random() - 0.5);

      // ✅ 1) Create quiz attempt in mcq_quizzes
      const { data: insertedQuiz, error: insQuizErr } = await supabase
        .from("mcq_quizzes")
        .insert([
          {
            user_id: userData.user.id,
            course_id: courseId,
            lecture_id: lectureId ? lectureId : null,
            mode,
            total_questions: list.length,
            correct_count: 0,
            score: 0,
            started_at: new Date().toISOString(),
            submitted_at: null,
          },
        ])
        .select("id")
        .single();

      if (insQuizErr || !insertedQuiz?.id) {
        setErr("فشل إنشاء محاولة (mcq_quizzes). غالبًا RLS مانع الطالب.");
        return;
      }

      const newQuizId = insertedQuiz.id as string;
      setQuizId(newQuizId);

      // ✅ 2) Save quiz questions order
      const quizQs = list.map((qq, i) => ({
        quiz_id: newQuizId,
        question_id: qq.id,
        order_index: i,
      }));

      const { error: insQQErr } = await supabase.from("mcq_quiz_questions").insert(quizQs);
      if (insQQErr) {
        setErr("فشل حفظ ترتيب الأسئلة (mcq_quiz_questions).");
        return;
      }

      setQuestions(list);

      const params = new URLSearchParams();
      params.set("course", courseId);
      if (lectureId) params.set("lecture", lectureId);
      params.set("mode", mode);
      router.replace(`/mcq?${params.toString()}`);
    } finally {
      setLoading(false);
    }
  }

  function choose(choiceIndex: number) {
    if (!current) return;
    setAnswers((p) => ({ ...p, [current.id]: choiceIndex }));
  }

  async function submit() {
    setErr(null);

    if (!questions.length || !quizId) {
      setErr("ابدأ اختبار الأول.");
      return;
    }

    const unanswered = questions.filter((q) => answers[q.id] === undefined).length;
    if (unanswered > 0) {
      setErr(`لسه في ${unanswered} سؤال بدون إجابة.`);
      return;
    }

    const correct = questions.filter((q) => answers[q.id] === q.correct_index).length;
    const score = Math.round((correct / questions.length) * 100);

    setSubmitted(true);

    // ✅ Save answers
    const now = new Date().toISOString();
    const rows = questions.map((q) => ({
      quiz_id: quizId,
      question_id: q.id,
      selected_index: answers[q.id],
      is_correct: answers[q.id] === q.correct_index,
      answered_at: now,
    }));

    const { error: ansErr } = await supabase.from("mcq_quiz_answers").insert(rows);
    if (ansErr) {
      setErr("فشل حفظ الإجابات (mcq_quiz_answers). غالبًا RLS.");
      return;
    }

    // ✅ Update quiz summary
    const { error: updErr } = await supabase
      .from("mcq_quizzes")
      .update({
        total_questions: questions.length,
        correct_count: correct,
        score,
        submitted_at: now,
      })
      .eq("id", quizId);

    if (updErr) {
      setErr("فشل تحديث نتيجة المحاولة (mcq_quizzes).");
      return;
    }
  }

  const correctCount = useMemo(
    () => questions.filter((q) => answers[q.id] === q.correct_index).length,
    [questions, answers]
  );

  const progress = useMemo(
    () => (questions.length ? `${idx + 1}/${questions.length}` : "0/0"),
    [idx, questions.length]
  );

  return (
    <AuthGuard>
      <TopNav />
      <main className="container">
        <div className="card">
          <div className="sectionHeader">
            <div className="sectionTitle">
              <h1 style={{ marginBottom: 6 }}>اختبارات MCQ</h1>
              <p className="muted" style={{ marginTop: 0 }}>
                اختار المادة/المحاضرة واضغط «ابدأ». تقدر تعمل تدريب أو امتحان.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <a className="btn btn--ghost" href="/mcq/history">
                سجل المحاولات
              </a>
            </div>
          </div>

          <div className="grid" style={{ marginTop: 12 }}>
            <div className="col-12 col-6">
              <label className="label">المادة</label>
              <select
                className="select"
                value={courseId}
                onChange={(e) => {
                  setCourseId(e.target.value);
                  setLectureId("");
                }}
              >
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
                value={lectureId || ""}
                onChange={(e) => setLectureId(e.target.value)}
                disabled={!courseId}
              >
                <option value="">(كل أسئلة المادة)</option>
                {lectures.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-12 col-6">
              <label className="label">الوضع</label>
              <select className="select" value={mode} onChange={(e) => setMode(e.target.value as any)}>
                <option value="practice">تدريب</option>
                <option value="exam">امتحان</option>
              </select>
            </div>

            <div className="col-12 col-6" style={{ display: "flex", alignItems: "end" }}>
              <button className="btn" onClick={start} disabled={!canStart || loading}>
                {loading ? "جاري التحميل…" : "ابدأ"}
              </button>
            </div>
          </div>

          {err ? (
            <p className="error" style={{ marginTop: 12 }}>
              {err}
            </p>
          ) : null}
        </div>

        {questions.length ? (
          <div className="card" style={{ marginTop: 12 }}>
            <div className="sectionHeader">
              <div className="sectionTitle" style={{ minWidth: 0 }}>
                <div className="rowTitle">
                  سؤال {progress}
                  {submitted ? <span className="pill" style={{ marginInlineStart: 10 }}>تم التسليم</span> : null}
                </div>
                <div className="muted" style={{ fontSize: 13 }}>
                  صحيح حتى الآن: {correctCount} / {questions.length}
                </div>
              </div>

              <div className="kpis">
                <span className="kpi">Mode: {mode === "exam" ? "امتحان" : "تدريب"}</span>
                <span className="kpi">محاضرة: {lectureId ? "محددة" : "كل المادة"}</span>
              </div>
            </div>

            <div className="divider" />

            <div className="muted" style={{ whiteSpace: "pre-wrap", fontSize: 16, lineHeight: 1.8 }}>
              {current?.question_text}
            </div>

            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              {current?.choices?.map((c, ci) => {
                const selected = answers[current.id] === ci;
                const isCorrect = ci === current.correct_index;

                const showCorrect = submitted && mode === "practice";
                const cls = [
                  "mcqOption",
                  selected ? "mcqOption--selected" : "",
                  showCorrect && isCorrect ? "mcqOption--correct" : "",
                  showCorrect && selected && !isCorrect ? "mcqOption--wrong" : "",
                ].filter(Boolean).join(" ");

                return (
                  <button key={ci} className={cls} onClick={() => !submitted && choose(ci)}>
                    <span className="mcqOption__letter">{letterFromIndex(ci)}</span>
                    <span className="mcqOption__text">{c}</span>
                  </button>
                );
              })}
            </div>

            <div className="divider" />

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn--ghost" onClick={() => setIdx((p) => Math.max(0, p - 1))} disabled={idx === 0}>
                السابق
              </button>
              <button className="btn btn--ghost" onClick={() => setIdx((p) => Math.min(questions.length - 1, p + 1))} disabled={idx >= questions.length - 1}>
                التالي
              </button>

              <div style={{ flex: 1 }} />

              <button className="btn" onClick={submit} disabled={submitted}>
                {submitted ? "تم التسليم" : "تسليم"}
              </button>
            </div>
          </div>
        ) : null}
      </main>
    </AuthGuard>
  );
}