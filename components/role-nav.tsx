import Link from "next/link";
import { signOutSeller } from "@/lib/auth-actions";
import { landingFor, type Access } from "@/lib/auth/access";
import { navigationFor } from "@/lib/auth/permissions";
import { Wordmark } from "@/components/wordmark";

export function RoleNav({ access }: { access: Access }) {
  const items = navigationFor(access.role, process.env.NODE_ENV === "development");
  return (
    <header>
      <div className="topbar">
        <Wordmark href={landingFor(access.role)} />
        {access.role !== "guest" ? (
          <form action={signOutSeller}>
            <button className="login-pill" type="submit">
              יציאה
            </button>
          </form>
        ) : (
          <Link className="login-pill" href="/login">
            כניסה
          </Link>
        )}
      </div>
      <nav className="nav" aria-label="ניווט">
        {items.map((link) => (
          <Link key={link.href} href={link.href}>
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export function Denied({ access }: { access: Access }) {
  return (
    <>
      <RoleNav access={access} />
      <p className="status">אין הרשאה למסך הזה.</p>
      <Link href={landingFor(access.role)}>חזרה למסך הבית של התפקיד</Link>
    </>
  );
}
