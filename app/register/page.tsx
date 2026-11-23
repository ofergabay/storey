import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthPanel } from "@/components/auth-panel";
import { LeadForm } from "@/components/lead-form";
import { SiteHeader } from "@/components/site-header";
import { readSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "הרשמה",
  description: "פתיחת חשבון יוצר ב-Storey.",
};

async function RegisterContent({ searchParams }: { searchParams: Promise<{ lead?: string; plan?: string; error?: string }> }) {
  const [session, params] = await Promise.all([readSession(), searchParams]);
  const leadPlan = params.lead === "1" && (params.plan === "branded" || params.plan === "scale") ? params.plan : null;
  return (
    <>
      <SiteHeader email={session.email} />
      {leadPlan ? (
        <LeadForm plan={leadPlan} />
      ) : (
        <AuthPanel mode="register" surface="page" nextPath="/onboarding?plan=social" errorCode={params.error} />
      )}
    </>
  );
}

export default function RegisterPage({ searchParams }: { searchParams: Promise<{ lead?: string; plan?: string; error?: string }> }) {
  return (
    <main className="shell auth-page">
      <Suspense fallback={<p className="status">טוען…</p>}>
        <RegisterContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
