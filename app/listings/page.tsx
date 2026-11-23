import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Denied, RoleNav } from "@/components/role-nav";
import { readAccess } from "@/lib/auth/access";
import { readCatalog } from "@/lib/catalog/store";
import { formatShekels } from "@/lib/money";

export const metadata: Metadata = { title: "המודעות שלי", description: "טיוטות ומחירים שפורסמו." };

async function ListingsContent() {
  const access = await readAccess();
  if (access.role === "guest") redirect("/login?next=/listings");
  if (access.role !== "creator" && access.role !== "admin") return <Denied access={access} />;
  const mine = readCatalog().listings.filter((item) => item.sellerId === access.userId);
  return (
    <>
      <RoleNav access={access} />
      <h1 className="page-title">המודעות שלי</h1>
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
                  <span dir="ltr">{`/s/${item.sellerHandle}/${item.slug}`}</span>
                  {" · "}
                  <a href={`https://wa.me/?text=${encodeURIComponent(`/s/${item.sellerHandle}/${item.slug}`)}`}>שיתוף בוואטסאפ</a>
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

export default function ListingsPage() {
  return (
    <main className="shell">
      <Suspense fallback={<p className="status">טוען…</p>}>
        <ListingsContent />
      </Suspense>
    </main>
  );
}
