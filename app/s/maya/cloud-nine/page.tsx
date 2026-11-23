import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { PublicListing } from "@/components/public-listing";
import { CHECKOUT_PATH } from "@/lib/checkout-quote";
import { LISTING_PATH, publicMetaDescription } from "@/lib/cloud-nine-public";
import { readPublicCard } from "@/lib/listing-records";
import { formatShekels } from "@/lib/money";
import { requestOrigin } from "@/lib/request-origin";

export async function generateMetadata(): Promise<Metadata> {
  const card = await readPublicCard();
  const sellingPrice =
    card?.publishedRetailAgorot == null ? null : formatShekels(card.publishedRetailAgorot);
  const description = card
    ? publicMetaDescription({
        summary: card.summary,
        packLabel: card.packLabel,
        packSize: card.packSize,
        packUnit: card.packUnit,
        sellingPrice,
      })
    : "ערכת Cloud Nine.";
  const origin = await requestOrigin();
  const title = card?.title ?? "Cloud Nine";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      locale: "he_IL",
      type: "website",
      url: `${origin}${LISTING_PATH}`,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

async function RequestMarker() {
  await connection();
  return null;
}

async function CustomerPreview() {
  const card = await readPublicCard();
  if (!card) return <p className="status">המודעה לא זמינה כרגע.</p>;
  return (
    <PublicListing
      title={card.title}
      summary={card.summary}
      packLabel={card.packLabel}
      packSize={card.packSize}
      packUnit={card.packUnit}
      sellerHandle={card.sellerHandle}
      sellerInitials={card.sellerInitials}
      sellerName={card.sellerName}
      sellingPrice={card.publishedRetailAgorot == null ? null : formatShekels(card.publishedRetailAgorot)}
      checkoutHref={card.publishedRetailAgorot == null ? undefined : CHECKOUT_PATH}
    />
  );
}

export default function CustomerPreviewPage() {
  return (
    <main className="customer-shell">
      <Suspense fallback={null}>
        <RequestMarker />
      </Suspense>
      <Suspense fallback={<p className="status">טוען את התצוגה…</p>}>
        <CustomerPreview />
      </Suspense>
    </main>
  );
}
