import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PublicLanding } from "@/components/landing/public-landing";
import { landingFor, readAccess } from "@/lib/auth/access";
import { parseSelectedChannel } from "@/lib/landing/copy";
import { readLandingFaq } from "@/lib/landing/faq";

export const metadata: Metadata = {
  title: "Storey",
  description: "הופכים כל המלצה לעסק רווחי. בלי מלאי, בלי לוגיסטיקה.",
};

async function HomeContent({ searchParams }: { searchParams: Promise<{ preview?: string; channel?: string }> }) {
  const [access, query] = await Promise.all([readAccess(), searchParams]);
  const preview = access.role === "admin" && query.preview === "1";
  if (!preview) {
    const destination = landingFor(access.role);
    if (destination !== "/") redirect(destination);
  }

  return <PublicLanding faqs={readLandingFaq()} canEditFaq={preview} initialChannel={parseSelectedChannel(query.channel)} />;
}

export default function HomePage({ searchParams }: { searchParams: Promise<{ preview?: string; channel?: string }> }) {
  return (
    <Suspense fallback={<p className="status">טוען…</p>}>
      <HomeContent searchParams={searchParams} />
    </Suspense>
  );
}
