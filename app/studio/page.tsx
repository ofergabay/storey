import { WorkspaceTitle } from "@/components/workspace-title";
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SellerClaim } from "@/components/seller-auth";
import { SellerShell } from "@/components/seller-shell";
import { SellerWorkspace } from "@/components/seller-workspace";
import { Denied, RoleNav } from "@/components/role-nav";
import { openSurface } from "@/lib/auth/guards";
import { pickCopy } from "@/lib/i18n/locale";
import { readLocale } from "@/lib/i18n/server";
import { isDevelopmentAdmin } from "@/lib/auth/admin";
import { LISTING_PATH } from "@/lib/cloud-nine-public";
import { CLOUD_NINE_SELLER } from "@/lib/cloud-nine-seller";
import { readOwnerListing } from "@/lib/listing-records";
import { readLocalDraftAgorot } from "@/lib/published-price";
import { readSellerPlan } from "@/lib/seller-plan";
import { readSellerQuotes } from "@/lib/seller-quotes";
import { requestOrigin } from "@/lib/request-origin";
import { readSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "סטודיו מוכרת",
  description: "תמחור ופרסום ערכת Cloud Nine.",
};

async function WorkspaceLoader() {
  const session = await readSession();
  if (!session.userId || !session.email) redirect("/login?next=/studio");

  const supabase = await createClient();
  if (!supabase) return <p className="status">חסר חיבור ל-Supabase בסביבת הפיתוח.</p>;

  const access = await readOwnerListing();
  if (access.status === "unlinked") {
    return (
      <>
        <p className="hint">
          הסטודיו הזה מפרסם את Cloud Nine. מוצרים נוספים נמצאים <Link href="/catalog">בקטלוג</Link>.
        </p>
        <SellerClaim userId={session.userId} email={session.email} />
      </>
    );
  }
  if (access.status === "missing") {
    return <p className="status">צריך להריץ את מיגרציית Supabase לפני שאפשר לחבר את מאיה. הטיוטה המקומית נשמרה.</p>;
  }
  if (access.status === "error") {
    return <p className="status">לא הצלחנו לטעון את המודעה. הטיוטה המקומית נשמרה ואפשר לנסות שוב.</p>;
  }

  const [localDraft, origin, quotes, plan] = await Promise.all([
    readLocalDraftAgorot(),
    requestOrigin(),
    readSellerQuotes(),
    readSellerPlan(),
  ]);
  return (
    <SellerWorkspace
      wholesaleAgorot={access.listing.wholesaleAgorot}
      initialDraftAgorot={localDraft ?? access.listing.draftAgorot ?? CLOUD_NINE_SELLER.defaultRetailAgorot}
      publishedAgorot={access.listing.publishedAgorot}
      quotes={quotes}
      plan={plan}
      listingUrl={`${origin}${LISTING_PATH}`}
    />
  );
}

async function StudioFrame({ searchParams }: { searchParams: Promise<{ inspect?: string }> }) {
  const [query, locale] = await Promise.all([searchParams, readLocale()]);
  const opened = await openSurface("creator", "/studio", query.inspect, { allowAdmin: true });
  if ("denied" in opened) {
    return (
      <main className="shell">
        <Denied access={opened.denied} />
      </main>
    );
  }
  const { access } = opened;
  if (access.userId?.startsWith("dev-")) {
    return (
      <main className="shell">
        <RoleNav access={access} />
        <WorkspaceTitle he="סטודיו" en="Studio" />
        <p>{pickCopy(locale, "בוחרים מוצר מאושר, שומרים טיוטת מחיר, ומפרסמים רק אחרי שיש ספירת מלאי.", "Choose an approved product, save a price draft, and publish only after a stock count.")}</p>
        <div className="home-actions">
          <Link className="button-publish" href="/catalog">
            {pickCopy(locale, "בחירת מוצרים", "Choose products")}
          </Link>
          <Link className="button-secondary" href="/listings">
            {pickCopy(locale, "המודעות שלי", "My listings")}
          </Link>
        </div>
      </main>
    );
  }
  const session = await readSession();
  if (!session.userId) redirect("/login?next=/studio");
  return (
    <SellerShell current="pricing" admin={isDevelopmentAdmin(session.email)}>
      <Suspense fallback={<p className="status">{pickCopy(locale, "טוען את הסטודיו…", "Loading the studio…")}</p>}>
        <WorkspaceLoader />
      </Suspense>
    </SellerShell>
  );
}

export default function StudioPage({ searchParams }: { searchParams: Promise<{ inspect?: string }> }) {
  return (
    <Suspense fallback={<p className="status">טוען את הסטודיו…</p>}>
      <StudioFrame searchParams={searchParams} />
    </Suspense>
  );
}
