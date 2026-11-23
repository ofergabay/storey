import { Suspense } from "react";
import type { Metadata } from "next";
import { PlanCards } from "@/components/plan-cards";
import { RoleNav } from "@/components/role-nav";
import { readAccess } from "@/lib/auth/access";

export const metadata: Metadata = { title: "תוכניות", description: "השוואת תוכניות Storey." };

async function PlansContent() {
  const access = await readAccess();
  return (
    <>
      <RoleNav access={access} />
      <h1 className="page-title">תוכניות</h1>
      <p>רק מוכרת חברתית נפתחת עכשיו, במחיר 0 ₪ ובלי חיוב.</p>
      <PlanCards />
    </>
  );
}

export default function PlansPage() {
  return (
    <main className="shell">
      <Suspense fallback={<p className="status">טוען…</p>}>
        <PlansContent />
      </Suspense>
    </main>
  );
}
