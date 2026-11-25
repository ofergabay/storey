import { WorkspaceTitle } from "@/components/workspace-title";
import { Suspense } from "react";
import type { Metadata } from "next";
import { Denied, RoleNav } from "@/components/role-nav";
import { requireAdminPage } from "@/lib/auth/admin-gate";
import { approveApplication } from "@/lib/workspace/actions";
import { readWorkspace } from "@/lib/workspace/store";

export const metadata: Metadata = { title: "אישורים", description: "אישור יוצרים וספקים." };

async function ApprovalsContent() {
  const gate = await requireAdminPage("/admin/approvals");
  if (!gate.admin) return <Denied access={gate.access} />;
  const access = gate.access;
  const rows = readWorkspace().applications;
  return (
    <>
      <RoleNav access={access} />
      <WorkspaceTitle he="אישורי יוצרים וספקים" en="Creator and supplier approvals" />
      {rows.length === 0 ? <p className="status">אין בקשות ממתינות.</p> : null}
      <div className="catalog-list">
        {rows.map((row) => (
          <article className="card" key={row.id}>
            <div className="copy">
              <h2 className="section-title">{row.name || "בלי שם"}</h2>
              <p>{row.role === "supplier" ? "ספק" : "יוצר/ת"} · {row.status}</p>
              {row.missing.length > 0 ? <p>חסר: {row.missing.join(", ")}</p> : null}
              {row.status === "pending" ? (
                <form action={approveApplication}>
                  <input type="hidden" name="id" value={row.id} />
                  <button className="button-publish" type="submit">אישור</button>
                </form>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

export default function ApprovalsPage() {
  return (
    <main className="shell">
      <Suspense fallback={<p className="status">טוען…</p>}>
        <ApprovalsContent />
      </Suspense>
    </main>
  );
}
