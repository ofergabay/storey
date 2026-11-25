import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ChannelSelectionState } from "@/components/landing/channel-selection";
import { LandingBar } from "@/components/landing/landing-bar";
import { landingFor, readAccess } from "@/lib/auth/access";
import { readLocale } from "@/lib/i18n/server";
import { parseSelectedChannel } from "@/lib/landing/copy";

export const metadata: Metadata = { title: "תוכניות", description: "השוואת תוכניות Storey." };

async function PlansContent({ searchParams }: { searchParams: Promise<{ channel?: string }> }) {
  const [access, query, locale] = await Promise.all([readAccess(), searchParams, readLocale()]);
  if (access.role !== "guest") redirect(landingFor(access.role));
  return (
    <>
      <LandingBar initialLocale={locale} />
      <h1 className="page-title">{locale === "en" ? "Plans" : "תוכניות"}</h1>
      <p>{locale === "en" ? "Only Social Selling is open right now, with no charge." : "כרגע נפתח רק מסלול מכירה חברתית, בלי חיוב."}</p>
      <ChannelSelectionState locale={locale} initialChannel={parseSelectedChannel(query.channel)} />
    </>
  );
}

export default function PlansPage({ searchParams }: { searchParams: Promise<{ channel?: string }> }) {
  return (
    <main className="shell">
      <Suspense fallback={<p className="status">טוען…</p>}>
        <PlansContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
