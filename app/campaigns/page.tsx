import { WorkspaceTitle } from "@/components/workspace-title";
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Denied, RoleNav } from "@/components/role-nav";
import { openSurface } from "@/lib/auth/guards";
import { creatorAccess } from "@/lib/auth/permissions";
import { readSellerPlan } from "@/lib/seller-plan";
import { reserveCampaign } from "@/lib/workspace/actions";

export const metadata: Metadata = { title: "קמפיינים", description: "שמירת מלאי לקמפיין." };

async function CampaignsContent({ searchParams }: { searchParams: Promise<{ inspect?: string }> }) {
  const query = await searchParams;
  const opened = await openSurface("creator", "/campaigns", query.inspect);
  if ("denied" in opened) return <Denied access={opened.denied} />;
  const { access } = opened;
  const plan = await readSellerPlan();
  const level = creatorAccess(plan.code, "creator.campaign");
  return (
    <>
      <RoleNav access={access} />
      <WorkspaceTitle he="מלאי לקמפיין" en="Campaign stock" />
      {level !== "FULL_ACCESS" ? (
        <>
          <p className="status">המסלול {plan.nameHe} עדיין לא כולל שמירת מלאי לקמפיין. לא נשמר מלאי.</p>
          <Link className="button-secondary" href="/plans">
            לשדרוג המסלול
          </Link>
        </>
      ) : null}
      {level === "FULL_ACCESS" ? (
        <form action={reserveCampaign}>
          <input type="hidden" name="sku" value="PARTY-01" />
          <button className="button-secondary" type="submit">
            בקשת שמירה לקמפיין
          </button>
        </form>
      ) : null}
    </>
  );
}

export default function CampaignsPage({ searchParams }: { searchParams: Promise<{ inspect?: string }> }) {
  return (
    <main className="shell">
      <Suspense fallback={<p className="status">טוען…</p>}>
        <CampaignsContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
