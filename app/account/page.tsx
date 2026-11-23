import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RoleNav } from "@/components/role-nav";
import { readAccess } from "@/lib/auth/access";

export const metadata: Metadata = { title: "חשבון", description: "צוות, תוכנית וחיוב." };

async function AccountContent() {
  const access = await readAccess();
  if (access.role === "guest") redirect("/login?next=/account");
  return (
    <>
      <RoleNav access={access} />
      <h1 className="page-title">חשבון</h1>
      <p>תפקיד: {access.role}</p>
      <p>תוכנית: מוכרת חברתית, 0 ₪. חנות מותג ושותפת קנה מידה ממתינות למחיר ולספק סליקה.</p>
      <p>צוות: רק החשבון הזה. אין חברי צוות נוספים.</p>
      <p className="status">חיוב לא פעיל. אין כרטיס ואין חשבונית.</p>
      <Link href="/onboarding">סטטוס הבקשה</Link>
    </>
  );
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
