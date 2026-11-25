import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Denied, RoleNav } from "@/components/role-nav";
import { openSurface } from "@/lib/auth/guards";
import { planLabel } from "@/lib/auth/permissions";
import { pickCopy } from "@/lib/i18n/locale";
import { readLocale } from "@/lib/i18n/server";
import { readSellerPlan } from "@/lib/seller-plan";

export const metadata: Metadata = { title: "חשבון", description: "צוות, תוכנית וחיוב." };

async function AccountContent({ searchParams }: { searchParams: Promise<{ inspect?: string }> }) {
  const [query, locale] = await Promise.all([searchParams, readLocale()]);
  const opened = await openSurface("creator", "/account", query.inspect);
  if ("denied" in opened) return <Denied access={opened.denied} />;
  const { access, readOnly } = opened;
  return (
    <>
      <RoleNav access={access} />
      <h1 className="page-title">{pickCopy(locale, "תשלומים וחשבוניות", "Payments and invoices")}</h1>
      {readOnly ? <p className="status">{pickCopy(locale, "בדיקת ניהול מתועדת. זה אינו חשבון היוצר.", "This is a recorded admin inspection. It is not the creator account.")}</p> : null}
      <p>{pickCopy(locale, "תפקיד", "Role")}: {access.role === "admin" ? pickCopy(locale, "ניהול מערכת", "Admin") : pickCopy(locale, "יוצר/ת", "Creator")}</p>
      <PlanLine locale={locale} />
      <p>{pickCopy(locale, "צוות: רק החשבון הזה. אין חברי צוות נוספים.", "Team: this account only. There are no extra members.")}</p>
      <p className="status">{pickCopy(locale, "חיוב לא פעיל. אין כרטיס ואין חשבונית.", "Billing is inactive. There is no card and no invoice.")}</p>
      <Link href="/onboarding">{pickCopy(locale, "סטטוס הבקשה", "Application status")}</Link>
    </>
  );
}

async function PlanLine({ locale }: { locale: "he" | "en" }) {
  const plan = await readSellerPlan();
  const price = plan.priceAgorot === 0 ? <span dir="ltr">₪0</span> : pickCopy(locale, "המחיר עדיין לא אושר", "The price is not approved yet");
  const waiting = plan.code === "scale"
    ? pickCopy(locale, "המסלול כולל מלאי שמור ואריזה לפי הסכם.", "This plan includes reserved stock and packing under the agreement.")
    : plan.code === "branded"
      ? pickCopy(locale, "חנות מותג ממתינה לאישור מחיר ולסליקה.", "Branded Store is waiting for a price and for checkout.")
      : pickCopy(locale, "חנות מותג ושותפות ממתינות לאישור מחיר ולסליקה.", "Branded Store and Partnership are waiting for a price and for checkout.");
  return <p>{pickCopy(locale, "מסלול", "Plan")}: {planLabel(plan.code, locale)}, {price}. {waiting}</p>;
}

export default function AccountPage({ searchParams }: { searchParams: Promise<{ inspect?: string }> }) {
  return (
    <main className="shell">
      <Suspense fallback={<p className="status">טוען…</p>}>
        <AccountContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
