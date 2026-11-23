import Link from "next/link";
import { signOutSeller } from "@/lib/auth-actions";
import { isDevelopmentAdmin } from "@/lib/auth/admin";
import { Wordmark } from "@/components/wordmark";

export function SiteHeader({ email }: { email: string | null }) {
  const admin = isDevelopmentAdmin(email);

  return (
    <header>
      <div className="topbar">
        <Wordmark href="/" />
      </div>
      <nav className="nav" aria-label="ניווט">
        {email ? <Link href="/catalog">קטלוג</Link> : <Link href="/register">הרשמה</Link>}
        {email ? <Link href="/studio">סטודיו</Link> : <Link href="/login">כניסה</Link>}
        {admin ? <Link href="/admin">ניהול קטלוג ומלאי</Link> : null}
        {email ? (
          <form action={signOutSeller}>
            <button type="submit">יציאה</button>
          </form>
        ) : null}
      </nav>
    </header>
  );
}
