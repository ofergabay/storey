import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RoleNav } from "@/components/role-nav";
import { readAccess } from "@/lib/auth/access";
import { setDevRole } from "@/lib/auth/dev-role";

export const metadata: Metadata = { title: "הרשאות ותפקידים", description: "החלפת תפקיד לבדיקה מקומית." };

const roles = [
  ["guest", "אורח", "/"],
  ["creator", "יוצר/ת", "/studio"],
  ["supplier", "ספק", "/supplier"],
  ["warehouse", "מחסן", "/supplier"],
  ["admin", "ניהול מערכת", "/admin"],
] as const;

async function DevContent() {
  if (process.env.NODE_ENV !== "development") notFound();
  const access = await readAccess();
  return (
    <>
      <RoleNav access={access} />
      <h1 className="page-title">הרשאות ותפקידים</h1>
      <p>הבחירה נשמרת בדפדפן לשמונה שעות ומחליפה את החשבון המחובר רק במחשב הפיתוח. אין כאן חיוב ואין ספירת מחסן חיה.</p>
      <div className="home-actions">
        {roles.map(([role, label]) => (
          <form key={role} action={setDevRole.bind(null, role)}>
            <button className="button-secondary" type="submit">
              {label}
            </button>
          </form>
        ))}
      </div>
    </>
  );
}

export default function DevPage() {
  return (
    <main className="shell">
      <Suspense fallback={<p className="status">טוען…</p>}>
        <DevContent />
      </Suspense>
    </main>
  );
}
