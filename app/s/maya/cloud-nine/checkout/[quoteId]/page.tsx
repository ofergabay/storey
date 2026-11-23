import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { QuoteSummary } from "@/components/quote-summary";
import { Wordmark } from "@/components/wordmark";
import { readCheckoutQuote } from "@/lib/read-checkout-quote";

export const metadata: Metadata = {
  title: "הצעת מחיר",
  description: "הצעת מחיר ל-Cloud Nine. בלי מע״מ ובלי משלוח.",
  robots: { index: false, follow: false },
};

async function RequestMarker() {
  await connection();
  return null;
}

async function SavedQuoteLoader({ params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await params;
  const quote = await readCheckoutQuote(quoteId);
  if (!quote) return <p className="status">ההצעה לא נמצאה.</p>;
  return <QuoteSummary quote={quote} />;
}

export default function SavedQuotePage({ params }: { params: Promise<{ quoteId: string }> }) {
  return (
    <main className="customer-shell">
      <article className="customer-card">
        <header className="topbar customer-topbar">
          <Wordmark />
        </header>
        <Suspense fallback={null}>
          <RequestMarker />
        </Suspense>
        <Suspense fallback={<p className="status">טוען את ההצעה…</p>}>
          <SavedQuoteLoader params={params} />
        </Suspense>
      </article>
    </main>
  );
}
