import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Denied, RoleNav } from "@/components/role-nav";
import { readAccess } from "@/lib/auth/access";

export const metadata: Metadata = { title: "הגדרות מחסן", description: "צוות וחיבורים." };

async function SettingsContent() {
  const access = await readAccess();
  if (access.role === "guest") redirect("/login?next=/supplier/settings");
  if (access.role !== "supplier" && access.role !== "warehouse" && access.role !== "admin") return <Denied access={access} />;
  return (
    <>
      <RoleNav access={access} />
      <h1 className="page-title">הגדרות מחסן</h1>
      <p>מחסן פיתוח: PILOT-01. הצוות הוא החשבון הזה בלבד.</p>
      <p className="status">אין חיבור לחברת שילוח ואין חיבור למערכת מחסן חיצונית.</p>
    </>
  );
}

export default function SupplierSettingsPage() {
  return (
    <main className="shell">
      <Suspense fallback={<p className="status">טוען…</p>}>
        <SettingsContent />
      </Suspense>
    </main>
  );
}
