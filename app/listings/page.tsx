import { WorkspaceTitle } from "@/components/workspace-title";
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Denied, RoleNav } from "@/components/role-nav";
import { openSurface } from "@/lib/auth/guards";
import { readCatalog } from "@/lib/catalog/store";
import { formatShekels } from "@/lib/money";
import { requestOrigin } from "@/lib/request-origin";

export const metadata: Metadata = { title: "המודעות שלי", description: "טיוטות ומחירים שפורסמו." };

async function ListingsContent({ searchParams }: { searchParams: Promise<{ inspect?: string }> }) {
  const query = await searchParams;
  const opened = await openSurface("creator", "/listings", query.inspect);
  if ("denied" in opened) return <Denied access={opened.denied} />;
  const { access } = opened;
  const [mine, origin] = [readCatalog().listings.filter((item) => item.sellerId === access.userId), await requestOrigin()];
  return (
    <>
      <RoleNav access={access} />
      <WorkspaceTitle he="המודעות שלי" en="My listings" />
      {mine.length === 0 ? <p className="status">עדיין אין מודעות. בחירת מוצר נמצאת בקטלוג.</p> : null}
      <div className="catalog-list">
        {mine.map((item) => (
          <article className="card" key={item.sku}>
            <div className="copy">
              <h2 className="section-title" dir="ltr">{item.slug}</h2>
              <p>טיוטה: {item.draftAgorot ? formatShekels(item.draftAgorot) : "אין"}</p>
              <p>פורסם: {item.retailAgorot > 0 ? formatShekels(item.retailAgorot) : "עדיין לא פורסם"}</p>
              <p>{item.paused ? "המכירה מושהית" : item.retailAgorot > 0 ? "עמוד המכירה פעיל" : "טיוטה · טרם פורסמה"}</p>
              {item.retailAgorot > 0 ? (
                <p>
                  <a dir="ltr" href={`/s/${item.sellerHandle}/${item.slug}`}>{`/s/${item.sellerHandle}/${item.slug}`}</a>
                  {" · "}
                  <a href={`https://wa.me/?text=${encodeURIComponent(`${origin}/s/${item.sellerHandle}/${item.slug}`)}`}>שיתוף בוואטסאפ</a>
                </p>
              ) : null}
              <Link href={`/catalog/${item.sku}`}>עריכת מחיר</Link>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

export default function ListingsPage({ searchParams }: { searchParams: Promise<{ inspect?: string }> }) {
  return (
    <main className="shell">
      <Suspense fallback={<p className="status">טוען…</p>}>
        <ListingsContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
