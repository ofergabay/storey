"use client";

import { useState, type FormEvent } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export function RecoverForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    const supabase = createBrowserSupabase();
    if (supabase && email.includes("@")) {
      await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/login` });
    }
    setPending(false);
    setMessage("אם החשבון קיים, נשלח אליו קישור לאיפוס הסיסמה.");
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label htmlFor="recover-email">
        אימייל
        <input id="recover-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      </label>
      <button className="button-publish" type="submit" disabled={pending}>
        {pending ? "שולח…" : "שליחת קישור איפוס"}
      </button>
      {message ? <p className="status">{message}</p> : null}
    </form>
  );
}
