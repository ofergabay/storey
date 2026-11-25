import { WorkspaceTitle } from "@/components/workspace-title";
import { Suspense } from "react";
import type { Metadata } from "next";
import { Denied, RoleNav } from "@/components/role-nav";
import { openSurface } from "@/lib/auth/guards";
import { publishStoredTariff, retireStoredTariff, saveTariff } from "@/lib/commerce/payment/policy-actions";
import { readTariffs } from "@/lib/commerce/payment/policy-store";
import { previewTariff, type DeliveryService } from "@/lib/commerce/payment/tariffs";
import { nowMs } from "@/lib/commerce/payment/time";
import { formatShekels } from "@/lib/money";

export const metadata: Metadata = { title: "הגדרות מחסן", description: "צוות, תעריפי משלוח וחיבורים." };

const serviceLabel: Record<DeliveryService, string> = {
  standard: "משלוח רגיל",
  express: "משלוח מהיר",
  pickup: "איסוף עצמי",
};

const notice: Record<string, string> = {
  published: "התעריף פורסם.",
  draft: "הטיוטה נשמרה ולא חלה על קופה.",
  retired: "התעריף הופסק.",
  overlap: "יש כבר תעריף באותה עדיפות לאותו יעד. לא פורסם מחיר שני.",
  invalid: "התעריף לא תקין.",
  forbidden: "רק הספק שמחזיק במחסן יכול לפרסם תעריף.",
  warehouse: "אפשר לפרסם כרגע רק למחסן PILOT-01.",
  missing: "התעריף לא נמצא.",
};

async function SettingsContent({
  searchParams,
}: {
  searchParams: Promise<{ inspect?: string; tariff?: string; postcode?: string; city?: string; zone?: string; grams?: string; cm?: string; merchandise?: string }>;
}) {
  const query = await searchParams;
  const opened = await openSurface("supplier", "/supplier/settings", query.inspect);
  if ("denied" in opened) return <Denied access={opened.denied} />;
  const { access, readOnly } = opened;
  const own = access.role === "supplier" && !readOnly;
  const rules = readTariffs().filter((rule) => (own ? rule.supplierId === access.userId : true));
  const merchandise = Number(query.merchandise ?? "0");
  const preview = own && query.city !== undefined
    ? previewTariff({
        rules,
        supplierId: access.userId ?? "",
        warehouseCode: "PILOT-01",
        destination: { postcode: query.postcode ?? "", city: query.city ?? "", zone: query.zone ?? "" },
        grams: Number(query.grams ?? 0) || 0,
        longestCm: Number(query.cm ?? 0) || 0,
        merchandiseAgorot: Number.isInteger(merchandise) ? merchandise : 0,
        at: nowMs(),
      })
    : [];
  return (
    <>
      <RoleNav access={access} />
      <WorkspaceTitle he="הגדרות מחסן" en="Warehouse settings" />
      <p>מחסן פיתוח: PILOT-01. הצוות הוא החשבון הזה בלבד.</p>
      <p className="status">אין חיבור לחברת שילוח ואין חיבור למערכת מחסן חיצונית.</p>
      <section>
        <h2 className="section-title">תעריפי משלוח</h2>
        {query.tariff && notice[query.tariff] ? <p className="status">{notice[query.tariff]}</p> : null}
        {rules.length === 0 ? <p className="status">אין תעריפים.</p> : null}
        {rules.map((rule) => (
          <article className="card" key={rule.id}>
            <div className="copy">
              <p>
                {serviceLabel[rule.service]} · {rule.warehouseCode} · {rule.coverage.kind} {rule.coverage.value} · <span dir="ltr">{formatShekels(rule.priceAgorot)}</span>
              </p>
              <p>
                {rule.windowMinDays}–{rule.windowMaxDays} ימים · סגירה בשעה {rule.cutoffHour} · גרסה {rule.version} · {rule.status === "published" ? "מפורסם" : rule.status === "draft" ? "טיוטה" : "הופסק"}
              </p>
              {own && rule.status === "draft" ? (
                <form action={publishStoredTariff}>
                  <input type="hidden" name="id" value={rule.id} />
                  <button className="button-publish" type="submit">פרסום</button>
                </form>
              ) : null}
              {own && rule.status === "published" ? (
                <form action={retireStoredTariff}>
                  <input type="hidden" name="id" value={rule.id} />
                  <button className="button-secondary" type="submit">הפסקת תעריף</button>
                </form>
              ) : null}
            </div>
          </article>
        ))}
        {own ? (
          <form action={saveTariff}>
            <input type="hidden" name="warehouse" value="PILOT-01" />
            <label htmlFor="tariff-service">
              שירות
              <select id="tariff-service" name="service" defaultValue="standard">
                <option value="standard">משלוח רגיל</option>
                <option value="express">משלוח מהיר</option>
                <option value="pickup">איסוף עצמי</option>
              </select>
            </label>
            <label htmlFor="tariff-coverage">
              כיסוי
              <select id="tariff-coverage" name="coverage" defaultValue="nationwide">
                <option value="nationwide">כל הארץ</option>
                <option value="zone">אזור</option>
                <option value="city">עיר</option>
                <option value="postcode">מיקוד</option>
              </select>
            </label>
            <label htmlFor="tariff-value">
              יעד
              <input id="tariff-value" name="coverageValue" />
            </label>
            <label htmlFor="tariff-price">
              מחיר בש״ח
              <input id="tariff-price" name="price" inputMode="decimal" dir="ltr" required />
            </label>
            <label htmlFor="tariff-min">
              חלון מינימום בימים
              <input id="tariff-min" name="windowMin" type="number" min={0} defaultValue={2} required />
            </label>
            <label htmlFor="tariff-max">
              חלון מקסימום בימים
              <input id="tariff-max" name="windowMax" type="number" min={0} defaultValue={5} required />
            </label>
            <label htmlFor="tariff-cutoff">
              שעת סגירה
              <input id="tariff-cutoff" name="cutoff" type="number" min={0} max={23} defaultValue={14} required />
            </label>
            <label htmlFor="tariff-date">
              תאריך תחולה
              <input id="tariff-date" name="effectiveOn" type="date" required />
            </label>
            <label htmlFor="tariff-band-min">
              רצועת משקל מגרם
              <input id="tariff-band-min" name="bandMin" type="number" min={0} />
            </label>
            <label htmlFor="tariff-band-max">
              עד גרם
              <input id="tariff-band-max" name="bandMax" type="number" min={0} />
            </label>
            <label htmlFor="tariff-band-price">
              מחיר הרצועה בש״ח
              <input id="tariff-band-price" name="bandPrice" inputMode="decimal" dir="ltr" />
            </label>
            <label htmlFor="tariff-bulky">
              מסף פריט גדול בס״מ
              <input id="tariff-bulky" name="bulkyCm" type="number" min={0} />
            </label>
            <label htmlFor="tariff-bulky-price">
              תוספת לפריט גדול בש״ח
              <input id="tariff-bulky-price" name="bulkyPrice" inputMode="decimal" dir="ltr" />
            </label>
            <label htmlFor="tariff-free">
              סף משלוח חינם על חשבון הספק בש״ח
              <input id="tariff-free" name="freeAt" inputMode="decimal" dir="ltr" />
            </label>
            <button className="button-secondary" name="intent" value="draft" type="submit">שמירת טיוטה</button>
            <button className="button-publish" name="intent" value="publish" type="submit">פרסום</button>
          </form>
        ) : (
          <p className="status">צפייה בלבד. פרסום תעריף נעשה מחשבון הספק.</p>
        )}
        {own ? (
          <form method="get">
            <h3 className="section-title">תצוגה מקדימה</h3>
            <label htmlFor="preview-city">
              עיר
              <input id="preview-city" name="city" defaultValue={query.city ?? ""} />
            </label>
            <label htmlFor="preview-postcode">
              מיקוד
              <input id="preview-postcode" name="postcode" dir="ltr" defaultValue={query.postcode ?? ""} />
            </label>
            <label htmlFor="preview-zone">
              אזור
              <input id="preview-zone" name="zone" defaultValue={query.zone ?? ""} />
            </label>
            <label htmlFor="preview-grams">
              משקל הסל בגרם
              <input id="preview-grams" name="grams" type="number" min={0} defaultValue={query.grams ?? 0} />
            </label>
            <label htmlFor="preview-cm">
              צלע ארוכה בס״מ
              <input id="preview-cm" name="cm" type="number" min={0} defaultValue={query.cm ?? 0} />
            </label>
            <label htmlFor="preview-merch">
              סחורה באגורות
              <input id="preview-merch" name="merchandise" type="number" min={0} defaultValue={query.merchandise ?? 0} />
            </label>
            <button className="button-secondary" type="submit">הצגת התעריף הזוכה</button>
          </form>
        ) : null}
        {preview.map((price) => (
          <p key={price.rule.id}>
            זוכה: {serviceLabel[price.rule.service]} · {price.rule.id} · <span dir="ltr">{formatShekels(price.buyerAgorot)}</span>
            {" "}· {price.windowMinDays}–{price.windowMaxDays} ימים
          </p>
        ))}
      </section>
    </>
  );
}

export default function SupplierSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ inspect?: string; tariff?: string; postcode?: string; city?: string; zone?: string; grams?: string; cm?: string; merchandise?: string }>;
}) {
  return (
    <main className="shell">
      <Suspense fallback={<p className="status">טוען…</p>}>
        <SettingsContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
