import { Suspense } from "react";
import { connection } from "next/server";
import { beginListingCheckout } from "@/lib/workspace/actions";
import { policyForSeller } from "@/lib/commerce/payment/cohort";
import { rateAt } from "@/lib/commerce/payment/commissions";
import { WEEKLY_POLICY } from "@/lib/commerce/payment/flag";
import { readCommissions, readTariffs } from "@/lib/commerce/payment/policy-store";
import { quoteListing } from "@/lib/commerce/payment/shipping-quote";
import type { DeliveryService } from "@/lib/commerce/payment/tariffs";
import { readCatalog } from "@/lib/catalog/store";
import { nowMs } from "@/lib/commerce/payment/time";
import { formatShekels } from "@/lib/money";

const serviceLabel: Record<DeliveryService, string> = {
  standard: "משלוח רגיל",
  express: "משלוח מהיר",
  pickup: "איסוף עצמי",
};

const holdNote: Record<string, string> = {
  stock: "אין מספיק מארזים פנויים. המלאי לא נשמר.",
  missing: "הקישור אינו פעיל.",
  shipping: "אין שירות משלוח זמין לפריטים האלה ביעד הזה. אפשר לשנות כתובת או להוציא פריט.",
  rate: "עמלות Storey עדיין לא פורסמו. אי אפשר לאשר תשלום.",
  stale: "הכתובת, הסל או השירות השתנו. צריך לאשר הצעה מעודכנת לפני תשלום.",
};

async function CheckoutContent({
  params,
  searchParams,
}: {
  params: Promise<{ seller: string; listing: string }>;
  searchParams: Promise<{ hold?: string; postcode?: string; city?: string; zone?: string; quantity?: string; service?: string; c?: string; o?: string; k?: string; ch?: string }>;
}) {
  await connection();
  const [{ seller, listing }, query] = await Promise.all([params, searchParams]);
  const saved = readCatalog().listings.find((item) => item.sellerHandle === seller && item.slug === listing && item.retailAgorot > 0);
  if (!saved) {
    return (
      <article className="customer-card">
        <div className="copy">
          <h1 className="page-title">הקישור אינו פעיל</h1>
          <a className="button-secondary" href={`/s/${seller}/${listing}`}>חזרה למודעה</a>
        </div>
      </article>
    );
  }
  const product = readCatalog().products.find((item) => item.sku === saved.sku);
  const policy = policyForSeller(seller);
  const quantity = Math.min(20, Math.max(1, Number(query.quantity ?? 1) || 1));
  if (policy !== WEEKLY_POLICY || !product) {
    return (
      <article className="customer-card">
        <div className="copy">
          <a className="button-secondary" href={`/s/${seller}/${listing}`}>חזרה למודעה</a>
          <h1 className="page-title">הצעת מחיר</h1>
          <p>
            מחיר למארז <strong dir="ltr">{formatShekels(saved.retailAgorot)}</strong>
          </p>
          <p className="hint">שמירת ההצעה והעגלה לא שומרות מלאי. רק התחלת קופה שומרת מארזים ל-10 דקות. אין תשלום.</p>
          <p>הצעה חדשה נשמרת במדיניות <span dir="ltr">{policy}</span>.</p>
          {query.hold === "stock" ? <p className="status">אין מספיק מארזים פנויים. המלאי לא נשמר.</p> : null}
          <form action={beginListingCheckout}>
            <input type="hidden" name="seller" value={seller} />
            <input type="hidden" name="slug" value={listing} />
            <input type="hidden" name="c" value={query.c ?? ""} />
            <input type="hidden" name="o" value={query.o ?? ""} />
            <input type="hidden" name="k" value={query.k ?? ""} />
            <input type="hidden" name="ch" value={query.ch ?? ""} />
            <label htmlFor="checkout-qty">
              כמות מארזים
              <input id="checkout-qty" name="quantity" type="number" min={1} max={20} defaultValue={1} />
            </label>
            <button className="button-publish" type="submit">
              התחלת קופה
            </button>
          </form>
        </div>
      </article>
    );
  }
  const owners = [...new Set(readTariffs().filter((rule) => rule.status === "published" && rule.warehouseCode === product.warehouseCode).map((rule) => rule.supplierId))];
  const supplierId = owners.length === 1 ? owners[0] ?? "" : "";
  const destination = { postcode: query.postcode ?? "", city: query.city ?? "", zone: query.zone ?? "" };
  const quotedAt = nowMs();
  const rate = rateAt(readCommissions().cards, quotedAt);
  const quoted = supplierId
    ? quoteListing({
        supplierId,
        warehouseCode: product.warehouseCode,
        sku: product.sku,
        quantity,
        retailAgorot: saved.retailAgorot,
        wholesaleAgorot: product.costAgorot,
        destination,
        rules: readTariffs(),
        rate: rate ? { id: rate.id, supplierBps: rate.supplierBps, creatorBps: rate.creatorBps } : null,
        at: quotedAt,
        service: query.service ?? "",
        creatorFundsShipping: saved.creatorFundsShipping === true,
      })
    : null;
  return (
    <article className="customer-card">
      <div className="copy">
        <a className="button-secondary" href={`/s/${seller}/${listing}`}>חזרה למודעה</a>
        <h1 className="page-title">הצעת מחיר</h1>
        <p>
          מחיר סחורה <strong dir="ltr">{formatShekels(saved.retailAgorot * quantity)}</strong>
        </p>
        <p>הצעה חדשה נשמרת במדיניות <span dir="ltr">{WEEKLY_POLICY}</span>. המשלוח מחושב לפני תשלום.</p>
        {query.hold && holdNote[query.hold] ? <p className="status">{holdNote[query.hold]}</p> : null}
        <form method="get">
          <label htmlFor="checkout-qty">
            כמות מארזים
            <input id="checkout-qty" name="quantity" type="number" min={1} max={20} defaultValue={quantity} />
          </label>
          <label htmlFor="checkout-city">
            עיר
            <input id="checkout-city" name="city" defaultValue={destination.city} />
          </label>
          <label htmlFor="checkout-postcode">
            מיקוד
            <input id="checkout-postcode" name="postcode" dir="ltr" defaultValue={destination.postcode} />
          </label>
          <label htmlFor="checkout-zone">
            אזור
            <input id="checkout-zone" name="zone" defaultValue={destination.zone} />
          </label>
          <button className="button-secondary" type="submit">רענון הצעה</button>
        </form>
        {quoted?.groups.map((group) => (
          <section key={group.id}>
            <p>קבוצת משלוח · מחסן {group.warehouseCode}</p>
            {group.options.length === 0 ? <p className="status">אין שירות זמין לפריטים: {group.itemIds.join(", ")}</p> : null}
            {group.options.map((option) => (
              <p key={option.service}>
                {serviceLabel[option.service]} · <span dir="ltr">{formatShekels(option.buyerAgorot)}</span>
                {" "}· הגעה {option.windowMinDays}–{option.windowMaxDays} ימים
                {option.service === group.selected ? " · נבחר" : ""}
                {option.sponsor === "supplier" ? " · המשלוח על חשבון הספק" : ""}
                {option.sponsor === "creator" ? " · המשלוח על חשבון היוצר/ת" : ""}
              </p>
            ))}
          </section>
        ))}
        {quoted?.ok && quoted.snapshot ? (
          <form action={beginListingCheckout}>
            <input type="hidden" name="seller" value={seller} />
            <input type="hidden" name="slug" value={listing} />
            <input type="hidden" name="quantity" value={String(quantity)} />
            <input type="hidden" name="postcode" value={destination.postcode} />
            <input type="hidden" name="city" value={destination.city} />
            <input type="hidden" name="zone" value={destination.zone} />
            <input type="hidden" name="quoteHash" value={quoted.hash} />
            <input type="hidden" name="c" value={query.c ?? ""} />
            <input type="hidden" name="o" value={query.o ?? ""} />
            <input type="hidden" name="k" value={query.k ?? ""} />
            <input type="hidden" name="ch" value={query.ch ?? ""} />
            <fieldset>
              <legend>בחירת שירות</legend>
              {quoted.groups.flatMap((group) => group.options).map((option) => (
                <label key={option.service}>
                  <input type="radio" name="service" value={option.service} defaultChecked={option.service === quoted.groups[0]?.selected} />
                  {serviceLabel[option.service]}
                  {option.service === "pickup" ? " · יש לבחור במפורש" : ""}
                </label>
              ))}
            </fieldset>
            <p>משלוח <strong dir="ltr">{formatShekels(quoted.shippingAgorot)}</strong></p>
            <p>סה״כ לתשלום <strong dir="ltr">{formatShekels(quoted.chargeAgorot)}</strong></p>
            <button className="button-publish" type="submit">אישור ההצעה ושמירת מלאי</button>
          </form>
        ) : (
          <p className="status">אי אפשר להמשיך לתשלום לפני שיש שירות אחד לכל קבוצה והצעה מעודכנת.</p>
        )}
      </div>
    </article>
  );
}

export default function ListingCheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ seller: string; listing: string }>;
  searchParams: Promise<{ hold?: string; postcode?: string; city?: string; zone?: string; quantity?: string; service?: string; c?: string; o?: string; k?: string; ch?: string }>;
}) {
  return (
    <main className="customer-shell">
      <Suspense fallback={<p className="status">טוען…</p>}>
        <CheckoutContent params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
