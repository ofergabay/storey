import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { FirstShare } from "@/components/first-share";
import { CatalogPricing } from "@/components/catalog-pricing";
import { experimentEnabled } from "@/lib/experiments/flags";
import { ensureShareLine } from "@/lib/experiments/actions";
import { readExperimentStore, rememberArm, writeExperimentStore } from "@/lib/experiments/store";
import { Denied, RoleNav } from "@/components/role-nav";
import { openSurface } from "@/lib/auth/guards";
import { CLOUD_NINE_SKU, sellerHandleFromEmail } from "@/lib/catalog/identity";
import { sellableQuantity } from "@/lib/catalog/model";
import { readCatalog } from "@/lib/catalog/store";
import { developmentPlans } from "@/lib/commerce/plans";
import { policyForSeller } from "@/lib/commerce/payment/cohort";
import { setCreatorFundsShipping } from "@/lib/catalog/actions";
import { packEarnings } from "@/lib/catalog/offer";
import { rateAt } from "@/lib/commerce/payment/commissions";
import { WEEKLY_POLICY } from "@/lib/commerce/payment/flag";
import { readCommissions, readTariffs } from "@/lib/commerce/payment/policy-store";
import { nowMs } from "@/lib/commerce/payment/time";
import { formatShekels } from "@/lib/money";

export const metadata: Metadata = {
  title: "תמחור מוצר",
  description: "קביעת מחיר מכירה למוצר מאושר.",
};

async function PricingContent({
  params,
  searchParams,
}: {
  params: Promise<{ sku: string }>;
  searchParams: Promise<{ campaign?: string; inspect?: string }>;
}) {
  await connection();
  const [{ sku }, query] = await Promise.all([params, searchParams]);
  const opened = await openSurface("creator", `/catalog/${sku}`, query.inspect, { allowAdmin: true });
  if ("denied" in opened) return <Denied access={opened.denied} />;
  const { access } = opened;
  if (sku === CLOUD_NINE_SKU) redirect("/studio");
  const catalog = readCatalog();
  const product = catalog.products.find((item) => item.sku === sku);
  if (!product) {
    return (
      <>
        <RoleNav access={access} />
        <p className="status">המוצר לא נמצא בקטלוג המאושר.</p>
        <Link href="/catalog">חזרה לקטלוג</Link>
      </>
    );
  }
  const stock = catalog.stock.find(
    (item) => item.sku === product.sku && item.warehouseCode === product.warehouseCode,
  );
  const listing = catalog.listings.find((item) => item.sellerId === access.userId && item.sku === product.sku);
  const sellable = sellableQuantity(stock);
  const feePolicy = policyForSeller(listing?.sellerHandle ?? sellerHandleFromEmail(access.email ?? access.userId ?? "", access.userId ?? ""));
  const rate = rateAt(readCommissions().cards, nowMs());
  const sampleFreight = readTariffs().find((rule) => rule.status === "published" && rule.warehouseCode === product.warehouseCode && rule.service === "standard")?.priceAgorot ?? 0;
  const fundedPreview = feePolicy === WEEKLY_POLICY && rate && listing?.creatorFundsShipping && sampleFreight > 0
    ? packEarnings(listing.retailAgorot, product.costAgorot, WEEKLY_POLICY, rate, sampleFreight)
    : null;
  const canPublishStock = sellable !== null;
  const stockLabel = stock?.halted
    ? "המכירה נעצרה עד לספירה תקינה."
    : sellable === null
      ? "עדיין אין ספירת מלאי תקינה."
      : `במלאי: ${sellable}`;
  const creatorId = access.userId ?? "";
  const experiment = rememberArm(readExperimentStore(), "first-share", creatorId, experimentEnabled("first-share"));
  if (experiment.created) writeExperimentStore(experiment.store);
  const savedLine = experiment.arm === "treatment" && creatorId
    ? await ensureShareLine({
        creatorId,
        productKey: product.sku,
        sku: product.sku,
        locale: "he",
        angle: "practical",
        why: listing?.recommendation?.trim() ?? "",
        facts: { title: product.titleHe, quantityLabel: `${product.packSize} ${product.unit}`, verifiedGuestCount: null },
      })
    : null;

  return (
    <>
      <RoleNav access={access} />
      <CatalogPricing
        sku={product.sku}
        title={product.titleHe}
        pack={`${product.packSize} ${product.unit}`}
        costAgorot={product.costAgorot}
        stockLabel={stockLabel}
        canPublishStock={canPublishStock}
        publishedAgorot={listing?.retailAgorot ?? 0}
        draftAgorot={listing?.draftAgorot ?? null}
        publishedHeadline={listing?.buyerHeadline ?? ""}
        publishedRecommendation={listing?.recommendation ?? ""}
        draftHeadline={listing?.draftHeadline ?? listing?.buyerHeadline ?? ""}
        draftRecommendation={listing?.draftRecommendation ?? listing?.recommendation ?? ""}
        paused={listing?.paused ?? false}
        salePath={listing ? `/s/${listing.sellerHandle}/${listing.slug}` : null}
        storefront={false}
        campaign={developmentPlans.find((plan) => plan.code === "social")?.canCampaign ?? false}
        feePolicy={feePolicy}
        rates={rate ? { supplierBps: rate.supplierBps, creatorBps: rate.creatorBps } : undefined}
      />
      {query.campaign ? <p className="status">טיוטת קמפיין {query.campaign}. המחיר, המלאי והמשלוח נבדקים שוב לפני פרסום. הקמפיין לא מתפרסם לבד.</p> : null}
      {savedLine ? (
        <FirstShare
          creatorId={creatorId}
          productKey={product.sku}
          sku={product.sku}
          title={product.titleHe}
          quantityLabel={`${product.packSize} ${product.unit}`}
          verifiedGuestCount={null}
          salePath={listing ? `/s/${listing.sellerHandle}/${listing.slug}` : null}
          initial={{ text: savedLine.text, manual: savedLine.manual, angle: savedLine.angle, why: savedLine.why, locale: savedLine.locale, attempt: 0 }}
        />
      ) : null}
      {feePolicy === WEEKLY_POLICY && listing && listing.retailAgorot > 0 ? (
        <section>
          <h2 className="section-title">משלוח על חשבון היוצר/ת</h2>
          {rate ? <p>עמלה מפורסמת: ספק {rate.supplierBps / 100}% · יוצר/ת {rate.creatorBps / 100}%.</p> : <p className="status">עדיין אין עמלה מפורסמת. התמורה תוצג אחרי פרסום.</p>}
          {fundedPreview ? <p>{fundedPreview.hint} <strong dir="ltr">{fundedPreview.amount}</strong></p> : null}
          {sampleFreight > 0 ? <p>תעריף רגיל לדוגמה <span dir="ltr">{formatShekels(sampleFreight)}</span>. הקופה תשתמש בתעריף שחל על הכתובת.</p> : <p>הניכוי יחושב מתעריף הספק לפני התשלום.</p>}
          <form action={setCreatorFundsShipping}>
            <input type="hidden" name="sku" value={product.sku} />
            <input type="hidden" name="enabled" value={listing.creatorFundsShipping ? "no" : "yes"} />
            <button className="button-secondary" type="submit">{listing.creatorFundsShipping ? "ביטול מימון המשלוח" : "משלוח חינם על חשבוני"}</button>
          </form>
        </section>
      ) : null}
    </>
  );
}

export default function CatalogPricingPage({
  params,
  searchParams,
}: {
  params: Promise<{ sku: string }>;
  searchParams: Promise<{ campaign?: string }>;
}) {
  return (
    <main className="shell">
      <Suspense fallback={<p className="status">טוען את המוצר…</p>}>
        <PricingContent params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
