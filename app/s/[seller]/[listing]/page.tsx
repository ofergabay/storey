import { cookies, headers } from "next/headers";
import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { PublicListing } from "@/components/public-listing";
import { saveCart } from "@/lib/workspace/actions";
import { readCatalog } from "@/lib/catalog/store";
import { readAccess } from "@/lib/auth/access";
import { formatShekels } from "@/lib/money";
import { experimentEnabled } from "@/lib/experiments/flags";
import { shippingNotice } from "@/lib/experiments/pace";
import { listingPreview, qualifiedVisit } from "@/lib/experiments/share";
import { sellerHandleFromEmail } from "@/lib/catalog/identity";
import { readExperimentStore, rememberArm, writeExperimentStore } from "@/lib/experiments/store";
import { rateAt } from "@/lib/commerce/payment/commissions";
import { readCommissions, readTariffs } from "@/lib/commerce/payment/policy-store";
import { quoteListing } from "@/lib/commerce/payment/shipping-quote";
import type { DeliveryService } from "@/lib/commerce/payment/tariffs";
import { nowMs, zonedParts } from "@/lib/commerce/payment/time";

export const metadata: Metadata = {
  title: "מודעה",
  robots: { index: false, follow: false },
};

const serviceLabel: Record<DeliveryService, string> = {
  standard: "משלוח רגיל",
  express: "משלוח מהיר",
  pickup: "איסוף עצמי",
};

async function ListingContent({
  params,
  searchParams,
}: {
  params: Promise<{ seller: string; listing: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const [{ seller, listing }, query] = await Promise.all([params, searchParams]);
  const catalog = readCatalog();
  const saved = catalog.listings.find((item) => item.sellerHandle === seller && item.slug === listing && item.retailAgorot > 0);
  const product = saved ? catalog.products.find((item) => item.sku === saved.sku) : undefined;
  if (!saved || !product || saved.paused) return <p className="status">הקישור אינו פעיל</p>;
  const initials = saved.sellerHandle.slice(0, 2).toUpperCase();
  const visitor = (await cookies()).get("storey_vid")?.value ?? "";
  const viewer = await readAccess();
  const preview = listingPreview({
    previewQuery: query.preview === "1" || query.preview === "creator",
    viewerRole: viewer.role,
    viewerId: viewer.userId,
    viewerHandle: viewer.email || viewer.userId ? sellerHandleFromEmail(viewer.email ?? "", viewer.userId ?? "") : null,
    sellerId: saved.sellerId,
    sellerHandle: saved.sellerHandle,
  });
  const agent = (await headers()).get("user-agent") ?? "";
  if (visitor && experimentEnabled("first-share") && qualifiedVisit({ userAgent: agent, creatorPreview: preview })) {
    const store = readExperimentStore();
    const parts = zonedParts(nowMs(), "Asia/Jerusalem");
    const day = `${parts.y}-${parts.m}-${parts.d}`;
    const id = `${visitor}:${saved.sellerId}:${saved.sku}:${day}`;
    if (!store.visits.some((visit) => visit.id === id)) {
      store.visits.unshift({ id, creatorId: saved.sellerId, offerId: saved.sku, at: nowMs() });
      writeExperimentStore(store);
    }
  }
  const remembered = rememberArm(readExperimentStore(), "party-kit", visitor, experimentEnabled("party-kit"));
  if (remembered.created) writeExperimentStore(remembered.store);
  const tracked = `c=${encodeURIComponent(saved.sellerId)}&o=${encodeURIComponent(saved.sku)}&k=${encodeURIComponent(text(query.k) || saved.sku)}&ch=${encodeURIComponent(text(query.ch) || "copy")}`;
  const checkoutHref = `/s/${seller}/${listing}/checkout?${tracked}`;

  return (
    <>
      <PublicListing
        title={saved.buyerHeadline?.trim() || product.titleHe}
        summary={saved.recommendation?.trim() || "מוצר שפורסם מהקטלוג."}
        packLabel="מארז"
        packSize={product.packSize}
        packUnit={product.unit}
        sellerHandle={`@${saved.sellerHandle}`}
        sellerInitials={initials}
        sellerName={saved.sellerName}
        sellingPrice={formatShekels(saved.retailAgorot)}
        checkoutHref={remembered.arm === "treatment" ? undefined : checkoutHref}
        checkoutNote={remembered.arm === "treatment" ? "המחיר למעלה הוא מחיר הסחורה. המשלוח מחושב לפי היעד לפני תשלום." : undefined}
      />
      <form action={saveCart} className="copy">
        <input type="hidden" name="seller" value={seller} />
        <input type="hidden" name="slug" value={listing} />
        <input type="hidden" name="quantity" value="1" />
        <button className="button-secondary" type="submit">הוספה לעגלה</button>
      </form>
      {remembered.arm === "treatment" ? (
        <PartyKit
          seller={seller}
          listing={listing}
          title={product.titleHe}
          packSize={product.packSize}
          unit={product.unit}
          retailAgorot={saved.retailAgorot}
          warehouseCode={product.warehouseCode}
          sku={product.sku}
          wholesaleAgorot={product.costAgorot}
          creatorFundsShipping={saved.creatorFundsShipping === true}
          query={query}
          tracked={tracked}
        />
      ) : (
        <a className="button-publish" href={checkoutHref}>להצעת מחיר</a>
      )}
    </>
  );
}

function PartyKit({
  seller,
  listing,
  title,
  packSize,
  unit,
  retailAgorot,
  warehouseCode,
  sku,
  wholesaleAgorot,
  creatorFundsShipping,
  query,
  tracked,
}: {
  seller: string;
  listing: string;
  title: string;
  packSize: number;
  unit: string;
  retailAgorot: number;
  warehouseCode: string;
  sku: string;
  wholesaleAgorot: number;
  creatorFundsShipping: boolean;
  query: Record<string, string | string[] | undefined>;
  tracked: string;
}) {
  const city = text(query.city);
  const postcode = text(query.postcode);
  const zone = text(query.zone);
  const service = text(query.service);
  const previous = text(query.previous);
  const owners = [...new Set(readTariffs().filter((rule) => rule.status === "published" && rule.warehouseCode === warehouseCode).map((rule) => rule.supplierId))];
  const supplierId = owners.length === 1 ? owners[0] ?? "" : "";
  const asked = city.length > 0 || postcode.length > 0 || zone.length > 0;
  const quoted = asked && supplierId
    ? quoteListing({
        supplierId,
        warehouseCode,
        sku,
        quantity: 1,
        retailAgorot,
        wholesaleAgorot,
        destination: { city, postcode, zone },
        rules: readTariffs(),
        rate: rateCard(),
        at: nowMs(),
        service,
        creatorFundsShipping,
      })
    : null;
  const notice = shippingNotice({
    available: !asked || Boolean(supplierId && quoted?.ok),
    previousHash: previous || null,
    nextHash: quoted?.hash ?? null,
  });
  const href = quoted?.ok
    ? `/s/${seller}/${listing}/checkout?${tracked}&city=${encodeURIComponent(city)}&postcode=${encodeURIComponent(postcode)}&zone=${encodeURIComponent(zone)}&service=${encodeURIComponent(quoted.groups[0]?.selected ?? service)}&quantity=1`
    : "";

  return (
    <section className="customer-card">
      <h2 className="section-title">{title}</h2>
      <p>המארז כולל {packSize} {unit}.</p>
      <p>מחיר הסחורה <strong dir="ltr">{formatShekels(retailAgorot)}</strong></p>
      <form method="get">
        <label htmlFor="kit-city">עיר<input id="kit-city" name="city" defaultValue={city} /></label>
        <label htmlFor="kit-postcode">מיקוד<input id="kit-postcode" name="postcode" dir="ltr" defaultValue={postcode} /></label>
        <label htmlFor="kit-zone">אזור<input id="kit-zone" name="zone" defaultValue={zone} /></label>
        <input type="hidden" name="k" value={text(query.k)} />
        <input type="hidden" name="ch" value={text(query.ch)} />
        {quoted?.hash ? <input type="hidden" name="previous" value={quoted.hash} /> : null}
        <button className="button-secondary" type="submit">בדיקת משלוח</button>
      </form>
      {notice ? <p className="status">{notice}</p> : null}
      {quoted?.groups.flatMap((group) => group.options).map((option) => (
        <p key={option.service}>{serviceLabel[option.service]} · <span dir="ltr">{formatShekels(option.buyerAgorot)}</span> · הגעה {option.windowMinDays}–{option.windowMaxDays} ימים</p>
      ))}
      {quoted?.ok ? <p>סה״כ כולל משלוח <strong dir="ltr">{formatShekels(quoted.chargeAgorot)}</strong></p> : null}
      {href ? <a className="button-publish" href={href}>להצעת מחיר</a> : <p className="hint">ההצעה הסופית נבדקת שוב בקופה, כולל מלאי ומשלוח, לפני רכישה.</p>}
    </section>
  );
}

function rateCard() {
  const rate = rateAt(readCommissions().cards, nowMs());
  return rate ? { id: rate.id, supplierBps: rate.supplierBps, creatorBps: rate.creatorBps } : null;
}

function text(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default function PublishedListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ seller: string; listing: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <main className="customer-shell">
      <Suspense fallback={<p className="status">טוען את המודעה…</p>}>
        <ListingContent params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
