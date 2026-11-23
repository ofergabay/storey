import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { PlanCards } from "@/components/plan-cards";
import { RoleNav } from "@/components/role-nav";
import { Wordmark } from "@/components/wordmark";
import { readAccess } from "@/lib/auth/access";
import { LISTING_PATH } from "@/lib/cloud-nine-public";

export const metadata: Metadata = {
  title: "Storey",
  description: "בוחרים מוצרים, קובעים מחיר ומתחילים למכור.",
};

async function HomeContent() {
  const access = await readAccess();

  return (
    <>
      {access.role === "guest" ? (
        <header className="topbar public-bar">
          <Wordmark href="/" />
          <Link className="login-pill" href="/login">
            כניסה
          </Link>
        </header>
      ) : (
        <RoleNav access={access} />
      )}
      <section className="landing-hero">
        <h1>בוחרים מוצרים, קובעים מחיר ומתחילים למכור</h1>
        <p>יוצרים בוחרים מוצר וקובעים את המחיר. ספקים מאחסנים ושולחים. הלקוח קונה בקישור.</p>
      </section>
      <section className="audience-sheet">
        <input className="audience-input" id="audience-creator" type="radio" name="audience" defaultChecked />
        <input className="audience-input" id="audience-supplier" type="radio" name="audience" />
        <div className="folders" role="tablist" aria-label="בחירת תפקיד">
          <label htmlFor="audience-creator">יוצר/ת</label>
          <label htmlFor="audience-supplier">ספק</label>
        </div>
        <div className="creator-view">
          <PlanCards />
          <p className="hint audience-note">
            <Link href={LISTING_PATH}>מודעת דוגמה</Link>
          </p>
        </div>
        <div className="supplier-view">
          <h2>הצטרפות כספק</h2>
          <p>המחסן שומר, מלקט ושולח. ההזמנות מגיעות לליקוט בלי לגייס לקוחות בעצמכם.</p>
          <Link className="button-publish" href="/register/supplier">
            הגשת בקשה להצטרפות כספק
          </Link>
        </div>
      </section>
    </>
  );
}

export default function HomePage() {
  return (
    <main className="shell landing-shell">
      <Suspense fallback={<p className="status">טוען…</p>}>
        <HomeContent />
      </Suspense>
    </main>
  );
}
