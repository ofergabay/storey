import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RoleNav } from "@/components/role-nav";
import { readAccess, type AppRole } from "@/lib/auth/access";
import { readSellerPlan } from "@/lib/seller-plan";

export const metadata: Metadata = { title: "חשבון", description: "צוות, תוכנית וחיוב." };

async function AccountContent() {
  const access = await readAccess();
  if (access.role === "guest") redirect("/login?next=/account");
  return (
    <>
      <RoleNav access={access} />
      <h1 className="page-title">תשלומים וחשבוניות</h1>
      <p>תפקיד: {roleLabel(access.role)}</p>
      <PlanLine />
      <p>צוות: רק החשבון הזה. אין חברי צוות נוספים.</p>
      <p className="status">חיוב לא פעיל. אין כרטיס ואין חשבונית.</p>
      <Link href="/onboarding">סטטוס הבקשה</Link>
    </>
  );
}

async function PlanLine() {
  const plan = await readSellerPlan();
  const price = plan.priceAgorot === 0 ? "0 ₪" : "המחיר עדיין לא אושר";
  const waiting = plan.code === "scale"
    ? "המסלול כולל מלאי שמור ואריזה לפי הסכם."
    : plan.code === "branded"
      ? "שותפות ממתינה לאישור מחיר ולסליקה."
      : "חנות מותג ושותפות ממתינות לאישור מחיר ולסליקה.";
  return <p>מסלול: {plan.nameHe}, {price}. {waiting}</p>;
}

function roleLabel(role: AppRole): string {
  if (role === "creator") return "יוצר/ת";
  if (role === "supplier") return "ספק";
  if (role === "warehouse") return "מחסן";
  if (role === "admin") return "ניהול מערכת";
  return "אורח";
}

export default function AccountPage() {
  return (
    <main className="shell">
      <Suspense fallback={<p className="status">טוען…</p>}>
        <AccountContent />
      </Suspense>
    </main>
  );
}
