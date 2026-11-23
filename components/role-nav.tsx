import Link from "next/link";
import { signOutSeller } from "@/lib/auth-actions";
import { landingFor, type Access } from "@/lib/auth/access";

const links: Record<Access["role"], { href: string; label: string }[]> = {
  guest: [
    { href: "/register", label: "הרשמה כיוצר/ת" },
    { href: "/register/supplier", label: "הצטרפות כספק" },
    { href: "/login", label: "כניסה" },
    { href: "/plans", label: "תוכניות" },
  ],
  creator: [
    { href: "/studio", label: "סטודיו" },
    { href: "/catalog", label: "קטלוג" },
    { href: "/listings", label: "המודעות שלי" },
    { href: "/campaigns", label: "קמפיינים" },
    { href: "/storefront", label: "חנות" },
    { href: "/orders", label: "הזמנות" },
    { href: "/earnings", label: "הכנסות" },
    { href: "/account", label: "חשבון" },
  ],
  supplier: [
    { href: "/supplier", label: "תור אספקה" },
    { href: "/supplier/catalog", label: "הצעות" },
    { href: "/supplier/stock", label: "מלאי" },
    { href: "/supplier/returns", label: "החזרות" },
    { href: "/supplier/settlements", label: "התחשבנות" },
    { href: "/supplier/settings", label: "הגדרות" },
  ],
  warehouse: [
    { href: "/supplier", label: "תור מחסן" },
    { href: "/supplier/stock", label: "ספירות" },
    { href: "/supplier/returns", label: "קבלת החזרות" },
  ],
  admin: [
    { href: "/admin", label: "לוח בקרה" },
    { href: "/admin/staging", label: "תור בדיקה" },
    { href: "/admin/approvals", label: "אישורים" },
    { href: "/admin/catalog", label: "קטלוג שפורסם" },
    { href: "/admin/orders", label: "הזמנות" },
    { href: "/admin/finance", label: "כספים" },
    { href: "/admin/plans", label: "תוכניות" },
    { href: "/admin/audit", label: "ביקורת" },
  ],
};

export function RoleNav({ access }: { access: Access }) {
  return (
    <header>
      <div className="topbar">
        <Link href={landingFor(access.role)} className="wordmark" dir="ltr">
          storey.
        </Link>
      </div>
      <nav className="nav" aria-label="ניווט">
        {links[access.role].map((link) => (
          <Link key={link.href} href={link.href}>
            {link.label}
          </Link>
        ))}
        {process.env.NODE_ENV === "development" ? <Link href="/dev">תפקידי פיתוח</Link> : null}
        {access.role !== "guest" ? (
          <form action={signOutSeller}>
            <button type="submit">יציאה</button>
          </form>
        ) : null}
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
