import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Denied, RoleNav } from "@/components/role-nav";
import { readAccess } from "@/lib/auth/access";
import { creatorAccess } from "@/lib/auth/permissions";
import { readSellerPlan } from "@/lib/seller-plan";
import { reserveCampaign } from "@/lib/workspace/actions";

export const metadata: Metadata = { title: "קמפיינים", description: "שמירת מלאי לקמפיין." };

async function CampaignsContent() {
  const access = await readAccess();
  if (access.role === "guest") redirect("/login?next=/campaigns");
  if (access.role !== "creator") return <Denied access={access} />;
  const plan = await readSellerPlan();
  const level = creatorAccess(plan.code, "creator.campaign");
  return (
    <>
      <RoleNav access={access} />
      <h1 className="page-title">שריון מלאי וקמפיינים</h1>
      {level !== "FULL_ACCESS" ? (
        <>
          <p className="status">המסלול {plan.nameHe} עדיין לא כולל שריון מלאי לקמפיין. לא נשמר מלאי.</p>
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

export default function CampaignsPage() {
  return (
    <main className="shell">
      <Suspense fallback={<p className="status">טוען…</p>}>
        <CampaignsContent />
      </Suspense>
    </main>
  );
}
