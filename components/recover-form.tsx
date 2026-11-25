"use client";

import { useState, type FormEvent } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { pickCopy, type Locale } from "@/lib/i18n/locale";

export function RecoverForm({ locale = "he" }: { locale?: Locale }) {
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
    setMessage(pickCopy(locale, "אם החשבון קיים, נשלח אליו קישור לאיפוס הסיסמה.", "If the account exists, we sent it a link to reset the password."));
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label htmlFor="recover-email">
        {pickCopy(locale, "אימייל", "Email")}
        <input id="recover-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      </label>
      <button className="button-publish" type="submit" disabled={pending}>
        {pending ? pickCopy(locale, "שולח…", "Sending…") : pickCopy(locale, "שליחת קישור איפוס", "Send a reset link")}
      </button>
      {message ? <p className="status">{message}</p> : null}
    </form>
  );
}
