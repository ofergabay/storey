import { WorkspaceTitle } from "@/components/workspace-title";
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Denied, RoleNav } from "@/components/role-nav";
import { openSurface } from "@/lib/auth/guards";
import { creatorAccess } from "@/lib/auth/permissions";
import { readSellerPlan } from "@/lib/seller-plan";
import { saveStorefront } from "@/lib/workspace/actions";
import { readWorkspace } from "@/lib/workspace/store";

export const metadata: Metadata = { title: "חנות מותג", description: "אוסף, מדיניות ודומיין." };

async function StorefrontEditor({ searchParams }: { searchParams: Promise<{ inspect?: string }> }) {
  const query = await searchParams;
  const opened = await openSurface("creator", "/storefront", query.inspect);
  if ("denied" in opened) return <Denied access={opened.denied} />;
  const { access } = opened;
  const plan = await readSellerPlan();
  const level = creatorAccess(plan.code, "creator.storefront");
  const current = readWorkspace().storefronts.find((item) => item.sellerId === access.userId);
  return (
    <>
      <RoleNav access={access} />
      <WorkspaceTitle he="חנות מותג" en="Branded store" />
      {level !== "FULL_ACCESS" ? (
        <>
          <p className="status">חנות ודומיין משלכם נפתחים במסלול חנות מותג. המסלול {plan.nameHe} עדיין לא כולל אותם.</p>
          <Link className="button-secondary" href="/plans">
            לשדרוג המסלול
          </Link>
        </>
      ) : (
      <>
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
      )}
    </>
  );
}

export default function StorefrontPage({ searchParams }: { searchParams: Promise<{ inspect?: string }> }) {
  return (
    <main className="shell">
      <Suspense fallback={<p className="status">טוען…</p>}>
        <StorefrontEditor searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
