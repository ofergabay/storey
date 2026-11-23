"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export function AuthForm({ mode, nextPath }: { mode: "login" | "register"; nextPath: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const register = mode === "register";

  async function submit(event: FormEvent) {
    event.preventDefault();
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
    const result = register
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    setPending(false);
    if (result.error) {
      setMessage(authMessage(result.error.message, register));
      return;
    }
    if (register && !result.data.session) {
      setMessage("שלחנו אימייל לאישור החשבון. אשרו את ההודעה ואז היכנסו. אחרי האישור נפתח הקטלוג.");
      return;
    }
    router.push(nextPath);
    router.refresh();
  }

  return (
    <section className="card auth-card" aria-labelledby="auth-title">
      <div className="copy">
        <p className="kicker">{register ? "חשבון חדש" : "חשבון קיים"}</p>
        <h1 id="auth-title" className="page-title">
          {register ? "הרשמה" : "כניסה"}
        </h1>
        <p>{register ? "אחרי אישור האימייל מגיעים לקטלוג המוצרים." : "נכנסים עם האימייל והסיסמה של החשבון."}</p>
        <form className="auth-form" onSubmit={(event) => void submit(event)}>
          <label htmlFor="account-email">
            אימייל
            <input
              id="account-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label htmlFor="account-password">
            סיסמה
            <input
              id="account-password"
              type="password"
              autoComplete={register ? "new-password" : "current-password"}
              minLength={6}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button className="button-publish" type="submit" disabled={pending}>
            {pending ? "שולח…" : register ? "הרשמה" : "כניסה"}
          </button>
        </form>
        {message ? (
          <p className="status" role="status">
            {message}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function authMessage(message: string, register: boolean): string {
  if (/email not confirmed|not confirmed/i.test(message)) {
    return "האימייל ממתין לאישור. אשרו את ההודעה ואז היכנסו. אחרי האישור נפתח הקטלוג.";
  }
  if (/already registered|already been registered|user already/i.test(message)) {
    return "החשבון כבר קיים. אפשר להיכנס.";
  }
  if (/email_address_invalid|unable to validate email|invalid format/i.test(message)) {
    return "האימייל לא נראה כתובת שאפשר לאשר. השתמשו באימייל אמיתי.";
  }
  if (register) return "יצירת החשבון נכשלה. נסו אימייל אחר או סיסמה באורך 6 תווים לפחות.";
  return "האימייל או הסיסמה לא נכונים.";
}
