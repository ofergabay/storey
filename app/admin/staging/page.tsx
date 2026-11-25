import { WorkspaceTitle } from "@/components/workspace-title";
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Denied, RoleNav } from "@/components/role-nav";
import { requireAdminPage } from "@/lib/auth/admin-gate";
import { approveStaged, ignoreStaged } from "@/lib/catalog/actions";
import { readWorkspace } from "@/lib/workspace/store";

export const metadata: Metadata = { title: "תור בדיקה", description: "אישור או התעלמות משורות ייבוא." };

async function StagingContent() {
  const gate = await requireAdminPage("/admin/staging");
  if (!gate.admin) return <Denied access={gate.access} />;
  const access = gate.access;
  const rows = readWorkspace().staged;
  return (
    <>
      <RoleNav access={access} />
      <WorkspaceTitle he="תור בדיקה" en="Review queue" />
      <p>
        <Link href="/?preview=1">תצוגת דף הבית ועריכת שאלות</Link>
      </p>
      {rows.length === 0 ? (
        <p className="status">
          אין שורות בתור. <Link href="/admin">ייבוא מוצרים ומלאי</Link>
        </p>
      ) : null}
      <div className="catalog-list">
        {rows.map((row) => (
          <article className="card" key={row.id}>
            <div className="copy">
              <h2 className="section-title">{row.titleHe}</h2>
              <p dir="ltr">{row.sku}</p>
              <p>סטטוס: {row.state === "unreviewed" ? "ממתין" : row.state === "approved" ? "אושר" : "התעלמות"}</p>
              {row.state === "unreviewed" ? (
                <div className="home-actions">
                  <form action={approveStaged}>
                    <input type="hidden" name="id" value={row.id} />
                    <button className="button-publish" type="submit">אישור לקטלוג</button>
                  </form>
                  <form action={ignoreStaged}>
                    <input type="hidden" name="id" value={row.id} />
                    <button className="button-secondary" type="submit">התעלמות</button>
                  </form>
                </div>
              ) : null}
              {row.state === "approved" ? <Link href={`/admin/products/${row.sku}`}>עריכת מוצר</Link> : null}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

export default function StagingPage() {
  return (
    <main className="shell">
      <Suspense fallback={<p className="status">טוען…</p>}>
        <StagingContent />
      </Suspense>
    </main>
  );
}
