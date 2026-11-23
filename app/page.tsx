import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { PlanCards } from "@/components/plan-cards";
import { RoleNav } from "@/components/role-nav";
import { LISTING_PATH } from "@/lib/cloud-nine-public";
import { readAccess } from "@/lib/auth/access";

export const metadata: Metadata = {
  title: "Storey",
  description: "יוצרים בוחרים מוצר, קובעים מחיר ומשתפים קישור.",
};

async function HomeContent() {
  const access = await readAccess();

  return (
    <>
      <RoleNav access={access} />
      <section className="card">
        <div className="copy">
          <p className="kicker">מכירה בקישור</p>
          <h1 className="page-title">יוצרים בוחרים מוצר, קובעים מחיר ומשתפים קישור.</h1>
          <p>בוחרים מוצר מהקטלוג, רואים את עלות המארז ואת הרווח, מפרסמים מחיר, ושולחים ללקוחות קישור בלי עלות ובלי טיוטה.</p>
          <div className="home-actions">
            <Link className="button-publish" href="/register">
              הרשמה כיוצר/ת
            </Link>
            <Link className="button-secondary" href="/register/supplier">
              הצטרפות כספק
            </Link>
            <Link className="button-secondary" href="/login">
              כניסה
            </Link>
          </div>
          <p className="hint">
            <Link href={LISTING_PATH}>המודעה הפעילה של Cloud Nine</Link>
          </p>
        </div>
      </section>
      <PlanCards />
    </>
  );
}

export default function HomePage() {
  return (
    <main className="shell">
      <Suspense fallback={<p className="status">טוען…</p>}>
        <HomeContent />
      </Suspense>
    </main>
  );
}
