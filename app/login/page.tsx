"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/dashboard");
    });
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErr(error.message);
        return;
      }

      router.replace("/dashboard");
    } finally {
      setBusy(false);
    }
  }

  async function onSignup() {
    setErr(null);
    setBusy(true);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        setErr(error.message);
        return;
      }

      setErr(
        "تم إنشاء الحساب."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container">
      <div className="card">
        <h1>تسجيل الدخول</h1>
        <p className="muted">
          سجّل دخول بحسابك (أو اعمل حساب جديد) علشان تشوف المحتوى.
        </p>

        <form onSubmit={onSubmit} style={{ marginTop: 12 }}>
          <label className="label">الإيميل</label>
          <input
            className="input"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
          />

          <div style={{ height: 10 }} />

          <label className="label">كلمة السر</label>
          <input
            className="input"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="********"
          />

          <div style={{ height: 12 }} />

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button className="btn" type="submit" disabled={busy}>
              {busy ? "..." : "دخول"}
            </button>

            <button
              className="btn btn--ghost"
              type="button"
              disabled={busy}
              onClick={onSignup}
            >
              إنشاء حساب
            </button>
          </div>

          {err ? <p className="error">{err}</p> : null}
        </form>
      </div>

      <p className="muted" style={{ marginTop: 12 }}>
        نصيحة: لو عايز تمنع أي حد من برة الدفعة يعمل حساب، فعّل قيود الإيميل
        (Domain allowlist) من إعدادات Auth في Supabase.
      </p>
    </main>
  );
}
