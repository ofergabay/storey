import { Suspense } from "react";
import type { Metadata } from "next";
import { Denied, RoleNav } from "@/components/role-nav";
import { requireAdminPage } from "@/lib/auth/admin-gate";
import { pickCopy } from "@/lib/i18n/locale";
import { readLocale } from "@/lib/i18n/server";
import { readWorkspace } from "@/lib/workspace/store";

export const metadata: Metadata = { title: "ביקורת", description: "פעולות שנרשמו בפיתוח." };

async function AuditContent() {
  const [gate, locale] = await Promise.all([requireAdminPage("/admin/audit"), readLocale()]);
  if (!gate.admin) return <Denied access={gate.access} />;
  const access = gate.access;
  const rows = readWorkspace().audit;
  return (
    <>
      <RoleNav access={access} />
      <h1 className="page-title">{pickCopy(locale, "היסטוריית ביקורת", "Audit history")}</h1>
      {rows.length === 0 ? <p className="status">{pickCopy(locale, "אין פעולות שנרשמו.", "No recorded actions.")}</p> : null}
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
