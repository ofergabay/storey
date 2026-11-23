import { Suspense } from "react";
import type { Metadata } from "next";
import { RecoverForm } from "@/components/recover-form";
import { RoleNav } from "@/components/role-nav";
import { readAccess } from "@/lib/auth/access";

export const metadata: Metadata = { title: "שחזור חשבון", description: "איפוס סיסמה." };

async function RecoverContent() {
  const access = await readAccess();
  return (
    <>
      <RoleNav access={access} />
      <h1 className="page-title">שחזור חשבון</h1>
      <p>נשלח קישור איפוס אם הכתובת רשומה. לא נציין אם החשבון קיים.</p>
      <RecoverForm />
    </>
  );
}

export default function RecoverPage() {
  return (
    <main className="shell">
      <Suspense fallback={<p className="status">טוען…</p>}>
        <RecoverContent />
      </Suspense>
    </main>
  );
}
