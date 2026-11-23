import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PlanCards } from "@/components/plan-cards";
import { Denied, RoleNav } from "@/components/role-nav";
import { readAccess } from "@/lib/auth/access";

export const metadata: Metadata = { title: "תוכניות וחוזים", description: "כללי מחיר וחיבורים." };

async function AdminPlans() {
  const access = await readAccess();
  if (access.role === "guest") redirect("/login?next=/admin/plans");
  if (access.role !== "admin") return <Denied access={access} />;
  return (
    <>
      <RoleNav access={access} />
      <h1 className="page-title">תוכניות, חוזים וחיבורים</h1>
      <PlanCards />
      <p className="status">אין חוזה חתום, אין כלל מחיר נוסף, ואין חיבור סליקה. משימות שנכשלו לא נרשמו.</p>
    </>
  );
}

export default function AdminPlansPage() {
  return (
    <main className="shell">
      <Suspense fallback={<p className="status">טוען…</p>}>
        <AdminPlans />
      </Suspense>
    </main>
  );
}
