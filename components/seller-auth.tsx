"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { claimDemoSeller, signOutSeller } from "@/lib/auth-actions";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export function SellerSignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(mode: "sign-in" | "sign-up") {
    if (!email || password.length < 6) {
      setMessage("הזינו אימייל וסיסמה באורך 6 תווים לפחות.");
      return;
    }
    setPending(true);
    setMessage(null);
    const supabase = createBrowserSupabase();
    if (!supabase) {
      setMessage("חסר חיבור ל-Supabase.");
      setPending(false);
      return;
    }
    const result =
      mode === "sign-in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setPending(false);
    if (result.error) {
      setMessage(
        mode === "sign-in"
          ? "האימייל או הסיסמה לא נכונים."
          : "יצירת החשבון נכשלה. נסו אימייל אחר או סיסמה באורך 6 תווים לפחות.",
      );
      return;
    }
    if (mode === "sign-up" && !result.data.session) {
      setMessage("נשלח אימייל לאישור. אשרו אותו ואז התחברו.");
      return;
    }
    router.refresh();
  }

  return (
    <section className="card auth-card" aria-labelledby="sign-in-title">
      <div className="copy">
        <p className="kicker">סטודיו מוכרת</p>
        <h1 id="sign-in-title" className="page-title">
          כניסה
        </h1>
        <p>רק החשבון המחובר למאיה יכול לערוך ולפרסם את Cloud Nine.</p>
        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submit("sign-in");
          }}
        >
          <label htmlFor="seller-email">
            אימייל
            <input
              id="seller-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label htmlFor="seller-password">
            סיסמה
            <input
              id="seller-password"
              type="password"
              autoComplete="current-password"
              minLength={6}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button className="button-publish" type="submit" disabled={pending}>
            {pending ? "מתחבר…" : "כניסה"}
          </button>
        </form>
        <button
          className="button-secondary"
          type="button"
          disabled={pending}
          onClick={() => void submit("sign-up")}
        >
          יצירת חשבון
        </button>
        {message ? (
          <p className="status" role="status">
            {message}
          </p>
        ) : null}
      </div>
    </section>
  );
}

export function SellerClaim({ userId, email }: { userId: string; email: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const sql = `update public.sellers set owner_id = '${userId}' where slug = 'maya';`;

  async function claim() {
    setPending(true);
    const result = await claimDemoSeller();
    setPending(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    router.refresh();
  }

  return (
    <section className="card auth-card" aria-labelledby="claim-title">
      <div className="copy">
        <p className="kicker">סטודיו מוכרת</p>
        <h1 id="claim-title" className="page-title">
          חיבור למאיה
        </h1>
        <p>
          החשבון <span dir="ltr">{email}</span> מחובר, ועדיין לא משויך למוכרת מאיה.
        </p>
        <button className="button-publish" type="button" disabled={pending} onClick={() => void claim()}>
          {pending ? "מחבר…" : "חיבור החשבון למאיה"}
        </button>
        <p>אפשר גם להריץ ב-SQL Editor של Supabase:</p>
        <p className="sql" dir="ltr">
          {sql}
        </p>
        {message ? (
          <p className="status" role="status">
            {message}
          </p>
        ) : null}
        <form action={signOutSeller}>
          <button className="button-secondary" type="submit">
            יציאה
          </button>
        </form>
      </div>
    </section>
  );
}
