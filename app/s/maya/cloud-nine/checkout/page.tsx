import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { CheckoutForm } from "@/components/checkout-form";
import { Wordmark } from "@/components/wordmark";
import { LISTING_PATH, publicMetaDescription } from "@/lib/cloud-nine-public";
import { listCities } from "@/lib/israel-places";
import { readPublicCard } from "@/lib/listing-records";
import { formatShekels } from "@/lib/money";

export async function generateMetadata(): Promise<Metadata> {
  const card = await readPublicCard();
  const sellingPrice =
    card?.publishedRetailAgorot == null ? null : formatShekels(card.publishedRetailAgorot);
  const description = card
    ? `${publicMetaDescription({
        summary: card.summary,
        packLabel: card.packLabel,
        packSize: card.packSize,
        packUnit: card.packUnit,
        sellingPrice,
      })} בלי מע״מ ובלי משלוח.`
    : "הצעת מחיר לערכת Cloud Nine.";
  return {
    title: "הצעת מחיר",
    description,
    robots: { index: false, follow: false },
  };
}

async function RequestMarker() {
  await connection();
  return null;
}

async function CheckoutLoader() {
  const card = await readPublicCard();
  if (!card || card.publishedRetailAgorot == null) {
    return (
      <div className="copy">
        <h1 className="page-title">הקישור אינו פעיל</h1>
        <p>אפשר לשמור הצעת מחיר רק אחרי שהמחיר פורסם.</p>
        <a className="button-secondary" href={LISTING_PATH}>
          חזרה למודעה
        </a>
      </div>
    );
  }

  return (
    <div className="copy">
      <a className="button-secondary" href={LISTING_PATH}>חזרה למודעה</a>
      <p className="kicker">
        <span dir="ltr">{card.sellerHandle}</span>
      </p>
      <h1 className="page-title" dir="ltr">
        {card.title}
      </h1>
      <p className="pack">
        {card.packLabel} · {card.packSize} {card.packUnit}
      </p>
      <CheckoutForm
        title={card.title}
        packLabel={card.packLabel}
        unitAgorot={card.publishedRetailAgorot}
        cities={listCities()}
      />
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <main className="customer-shell">
      <article className="customer-card">
        <header className="topbar customer-topbar">
          <Wordmark href={LISTING_PATH} />
        </header>
        <Suspense fallback={null}>
          <RequestMarker />
        </Suspense>
        <Suspense fallback={<p className="status">טוען את הקופה…</p>}>
          <CheckoutLoader />
        </Suspense>
      </article>
    </main>
  );
}
