import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Denied, RoleNav } from "@/components/role-nav";
import { readAccess } from "@/lib/auth/access";
import { saveStorefront } from "@/lib/workspace/actions";
import { readWorkspace } from "@/lib/workspace/store";

export const metadata: Metadata = { title: "חנות מותג", description: "אוסף, מדיניות ודומיין." };

async function StorefrontEditor() {
  const access = await readAccess();
  if (access.role === "guest") redirect("/login?next=/storefront");
  if (access.role !== "creator" && access.role !== "admin") return <Denied access={access} />;
  const current = readWorkspace().storefronts.find((item) => item.sellerId === access.userId);
  return (
    <>
      <RoleNav access={access} />
      <h1 className="page-title">חנות מותג</h1>
      <p className="hint">דומיין מותאם לא אומת. החנות הציבורית נשארת בנתיב של Storey.</p>
      <form className="auth-form" action={saveStorefront}>
        <label htmlFor="collection">
          שם האוסף
          <input id="collection" name="collection" defaultValue={current?.collection ?? ""} />
        </label>
        <label htmlFor="policy">
          מדיניות החזרות
          <textarea id="policy" name="policy" defaultValue={current?.policy ?? ""} rows={4} />
        </label>
        <button className="button-publish" type="submit">
          שמירת החנות
        </button>
      </form>
    </>
  );
}

export default function StorefrontPage() {
  return (
    <main className="shell">
      <Suspense fallback={<p className="status">טוען…</p>}>
        <StorefrontEditor />
      </Suspense>
    </main>
  );
}
