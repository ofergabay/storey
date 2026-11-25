import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PublicLanding } from "@/components/landing/public-landing";
import { landingFor, readAccess } from "@/lib/auth/access";
import { sanitizeProductId } from "@/lib/auth/oauth";
import { parseSelectedChannel } from "@/lib/landing/copy";
import { readLocale } from "@/lib/i18n/server";
import { readLandingFaq } from "@/lib/landing/faq";

export const metadata: Metadata = {
  title: "Storey",
  description: "בוחרים מוצר, קובעים מחיר ומשתפים לינק. הספק אורז ושולח.",
};

async function HomeContent({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string; channel?: string; auth?: string; error?: string; product?: string }>;
}) {
  const [access, query, locale] = await Promise.all([readAccess(), searchParams, readLocale()]);
  const product = sanitizeProductId(query.product);
  if (product && (access.role === "creator" || access.role === "admin")) {
    redirect(`/catalog/start?product=${encodeURIComponent(product)}`);
  }
  const preview = access.role === "admin" && query.preview === "1";
  if (!preview) {
    const destination = landingFor(access.role);
    if (destination !== "/") redirect(destination);
  }

  return (
    <PublicLanding
      faqs={readLandingFaq()}
      canEditFaq={preview}
      initialChannel={parseSelectedChannel(query.channel)}
      initialAuth={query.auth === "register" ? "register" : query.auth === "login" ? "login" : null}
      authError={query.error === "google" ? "google" : null}
      initialProduct={sanitizeProductId(query.product)}
      signedInEligible={access.role === "creator" || access.role === "admin"}
      initialLocale={locale}
    />
  );
}

export default function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string; channel?: string; auth?: string; error?: string; product?: string }>;
}) {
  return (
    <Suspense fallback={<p className="status">טוען…</p>}>
      <HomeContent searchParams={searchParams} />
    </Suspense>
  );
}
