"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { googleCancelledHe, sanitizeNextPath, type AuthIntent, type AuthSurface } from "@/lib/auth/oauth";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { LandingLocale } from "@/lib/landing/copy";

export function AuthPanel({
  mode,
  nextPath,
  surface,
  locale = "he",
  errorCode = null,
  titleId = "auth-title",
  onModeChange,
}: {
  mode: AuthIntent;
  nextPath?: string;
  surface: AuthSurface;
  locale?: LandingLocale;
  errorCode?: string | null;
  titleId?: string;
  onModeChange?: (mode: AuthIntent) => void;
}) {
  const router = useRouter();
  const register = mode === "register";
  const copy = authCopy[locale];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(errorCode === "google" ? copy.googleCancelled : null);
  const [pending, setPending] = useState<"email" | "google" | null>(null);

  async function continueWithGoogle() {
    setPending("google");
    setMessage(null);
    const supabase = createBrowserSupabase();
    if (!supabase) {
      setMessage(copy.missingConnection);
      setPending(null);
      return;
    }
    const channel = register ? "social" : "";
    const next = sanitizeNextPath(nextPath);
    writeAuthCookie("storey_auth_intent", mode);
    writeAuthCookie("storey_auth_from", surface);
    writeAuthCookie("storey_auth_channel", channel);
    writeAuthCookie("storey_auth_next", next ? encodeURIComponent(next) : "");
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: "select_account" },
        skipBrowserRedirect: true,
      },
    });
    if (error || !data.url) {
      setMessage(copy.googleCancelled);
      setPending(null);
      return;
    }
    const unavailable = await googleProviderUnavailable(data.url);
    if (unavailable) {
      setMessage(copy.googleCancelled);
      setPending(null);
      return;
    }
    window.location.assign(data.url);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!email || password.length < 6) {
      setMessage(copy.shortPassword);
      return;
    }
    setPending("email");
    setMessage(null);
    const supabase = createBrowserSupabase();
    if (!supabase) {
      setMessage(copy.missingConnection);
      setPending(null);
      return;
    }
    const result = register
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    if (result.error) {
      setMessage(authMessage(result.error.message, register, copy));
      setPending(null);
      return;
    }
    if (register && !result.data.session) {
      setMessage(copy.confirmEmail);
      setPending(null);
      return;
    }
    const next = sanitizeNextPath(register ? "/onboarding?plan=social" : nextPath);
    router.push(`/auth/continue?intent=${mode}${next ? `&next=${encodeURIComponent(next)}` : ""}`);
    router.refresh();
  }

  const switchMode = register ? "login" : "register";

  return (
    <section className="auth-panel" aria-labelledby={titleId}>
      <h1 id={titleId}>{register ? copy.registerTitle : copy.loginTitle}</h1>
      {register ? <p className="auth-plan">{copy.freePlan}</p> : <p className="auth-plan">{copy.loginHint}</p>}
      <button className="auth-google" type="button" onClick={() => void continueWithGoogle()} disabled={pending !== null}>
        <GoogleMark />
        {pending === "google" ? copy.sending : copy.google}
      </button>
      <p className="auth-divider">{copy.orEmail}</p>
      <form className="auth-form" onSubmit={(event) => void submit(event)}>
        <label htmlFor={`${titleId}-email`}>
          {copy.email}
          <input
            id={`${titleId}-email`}
            type="email"
            dir="ltr"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label htmlFor={`${titleId}-password`}>
          {copy.password}
          <input
            id={`${titleId}-password`}
            type="password"
            dir="ltr"
            autoComplete={register ? "new-password" : "current-password"}
            minLength={6}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button className="button-publish" type="submit" disabled={pending !== null}>
          {pending === "email" ? copy.sending : register ? copy.registerAction : copy.loginAction}
        </button>
      </form>
      {mode === "login" ? (
        <p className="hint">
          <a href="/recover">{copy.forgot}</a>
        </p>
      ) : null}
      {onModeChange ? (
        <button className="auth-switch" type="button" onClick={() => onModeChange(switchMode)}>
          {register ? copy.toLogin : copy.toRegister}
        </button>
      ) : (
        <p className="hint">
          <a href={register ? "/login" : "/register"}>{register ? copy.toLogin : copy.toRegister}</a>
        </p>
      )}
      {message ? (
        <p className="status" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}

async function googleProviderUnavailable(url: string): Promise<boolean> {
  try {
    const probe = await fetch(url, { redirect: "manual" });
    if (probe.status >= 400) return true;
    if (probe.status === 0) return false;
    const body = await probe.text();
    return /provider is not enabled|validation_failed|unsupported provider/i.test(body);
  } catch {
    return false;
  }
}

function writeAuthCookie(name: string, value: string) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${value}; Path=/; Max-Age=600; SameSite=Lax${secure}`;
}

function GoogleMark() {
  return (
    <svg className="google-mark" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
    </svg>
  );
}

const authCopy = {
  he: {
    registerTitle: "הרשמה ל־Storey",
    loginTitle: "כניסה ל־Storey",
    freePlan: "מכירה חברתית · חינם",
    loginHint: "חשבון קיים נפתח שוב עם אותה זהות.",
    google: "המשך עם Google",
    orEmail: "או באמצעות אימייל",
    email: "אימייל",
    password: "סיסמה",
    registerAction: "הרשמה",
    loginAction: "כניסה",
    sending: "שולח…",
    forgot: "שכחתי את הסיסמה",
    toLogin: "יש לכם חשבון? כניסה",
    toRegister: "אין חשבון? הרשמה",
    shortPassword: "הזינו אימייל וסיסמה באורך 6 תווים לפחות.",
    missingConnection: "חסר חיבור ל-Supabase.",
    confirmEmail: "שלחנו אימייל לאישור החשבון. אשרו את ההודעה ואז היכנסו. אחרי הכניסה נפתחת ההרשמה למכירה חברתית.",
    googleCancelled: googleCancelledHe,
    notConfirmed: "האימייל ממתין לאישור. אשרו את ההודעה ואז היכנסו.",
    alreadyRegistered: "החשבון כבר קיים. אפשר להיכנס.",
    invalidEmail: "האימייל לא נראה כתובת שאפשר לאשר. השתמשו באימייל אמיתי.",
    registerFailed: "יצירת החשבון נכשלה. נסו אימייל אחר או סיסמה באורך 6 תווים לפחות.",
    loginFailed: "האימייל או הסיסמה לא נכונים.",
  },
  en: {
    registerTitle: "Sign up for Storey",
    loginTitle: "Log in to Storey",
    freePlan: "Social selling · Free",
    loginHint: "An existing account opens again with the same identity.",
    google: "Continue with Google",
    orEmail: "Or with email",
    email: "Email",
    password: "Password",
    registerAction: "Sign up",
    loginAction: "Log in",
    sending: "Sending…",
    forgot: "Forgot password",
    toLogin: "Already have an account? Log in",
    toRegister: "No account? Sign up",
    shortPassword: "Enter an email and a password of at least 6 characters.",
    missingConnection: "Supabase is not connected.",
    confirmEmail: "We sent a confirmation email. Confirm it, then log in to finish social selling.",
    googleCancelled: "Google sign-in was cancelled. Try again or continue with email.",
    notConfirmed: "The email is waiting for confirmation. Confirm it, then log in.",
    alreadyRegistered: "This account already exists. You can log in.",
    invalidEmail: "That email cannot be confirmed. Use a real email address.",
    registerFailed: "The account was not created. Try another email or a password of at least 6 characters.",
    loginFailed: "The email or password is incorrect.",
  },
} as const;

function authMessage(message: string, register: boolean, copy: (typeof authCopy)[LandingLocale]): string {
  if (/email not confirmed|not confirmed/i.test(message)) return copy.notConfirmed;
  if (/already registered|already been registered|user already|identity.*link|already linked/i.test(message)) return copy.alreadyRegistered;
  if (/email_address_invalid|unable to validate email|invalid format/i.test(message)) return copy.invalidEmail;
  return register ? copy.registerFailed : copy.loginFailed;
}
