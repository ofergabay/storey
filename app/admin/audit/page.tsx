import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Denied, RoleNav } from "@/components/role-nav";
import { readAccess } from "@/lib/auth/access";
import { readWorkspace } from "@/lib/workspace/store";

export const metadata: Metadata = { title: "ביקורת", description: "פעולות שנרשמו בפיתוח." };

async function AuditContent() {
  const access = await readAccess();
  if (access.role === "guest") redirect("/login?next=/admin/audit");
  if (access.role !== "admin") return <Denied access={access} />;
  const rows = readWorkspace().audit;
  return (
    <>
      <RoleNav access={access} />
      <h1 className="page-title">היסטוריית ביקורת</h1>
      {rows.length === 0 ? <p className="status">אין פעולות שנרשמו.</p> : null}
      <ul>
        {rows.map((row) => (
          <li key={`${row.at}-${row.action}-${row.detail}`}>{row.action} · {row.detail}</li>
        ))}
      </ul>
    </>
  );
}

export default function AuditPage() {
  return (
    <main className="shell">
      <Suspense fallback={<p className="status">טוען…</p>}>
        <AuditContent />
      </Suspense>
    </main>
  );
}
