import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Denied, RoleNav } from "@/components/role-nav";
import { readAccess } from "@/lib/auth/access";
import { reserveCampaign } from "@/lib/workspace/actions";

export const metadata: Metadata = { title: "קמפיינים", description: "שמירת מלאי לקמפיין." };

async function CampaignsContent() {
  const access = await readAccess();
  if (access.role === "guest") redirect("/login?next=/campaigns");
  if (access.role !== "creator") return <Denied access={access} />;
  return (
    <>
      <RoleNav access={access} />
      <h1 className="page-title">קמפיינים</h1>
      <p className="status">התוכנית מוכרת חברתית לא כוללת שמירת קמפיין או מלאי ייעודי. לא נשמר מלאי.</p>
      <form action={reserveCampaign}>
        <input type="hidden" name="sku" value="PARTY-01" />
        <button className="button-secondary" type="submit">
          בקשת שמירה לקמפיין
        </button>
      </form>
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
