import { Suspense } from "react";
import type { Metadata } from "next";
import { ChannelSelectionState } from "@/components/landing/channel-selection";
import { RoleNav } from "@/components/role-nav";
import { readAccess } from "@/lib/auth/access";
import { parseSelectedChannel } from "@/lib/landing/copy";

export const metadata: Metadata = { title: "תוכניות", description: "השוואת תוכניות Storey." };

async function PlansContent({ searchParams }: { searchParams: Promise<{ channel?: string }> }) {
  const [access, query] = await Promise.all([readAccess(), searchParams]);
  return (
    <>
      <RoleNav access={access} />
      <h1 className="page-title">תוכניות</h1>
      <p>כרגע נפתח רק מסלול מכירה חברתית, בלי חיוב.</p>
      <ChannelSelectionState initialChannel={parseSelectedChannel(query.channel)} />
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
