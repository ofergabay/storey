import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthPanel } from "@/components/auth-panel";
import { LandingBar } from "@/components/landing/landing-bar";
import { LeadForm } from "@/components/lead-form";
import { landingFor, readAccess } from "@/lib/auth/access";
import { readLocale } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "הרשמה",
  description: "פתיחת חשבון יוצר ב-Storey.",
};

async function RegisterContent({ searchParams }: { searchParams: Promise<{ lead?: string; plan?: string; error?: string }> }) {
  const [access, params, locale] = await Promise.all([readAccess(), searchParams, readLocale()]);
  if (access.role !== "guest") redirect(landingFor(access.role));
  const leadPlan = params.lead === "1" && (params.plan === "branded" || params.plan === "scale") ? params.plan : null;
  return (
    <>
      <LandingBar initialLocale={locale} />
      {leadPlan ? (
        <LeadForm plan={leadPlan} />
      ) : (
        <AuthPanel mode="register" surface="page" locale={locale} nextPath="/onboarding?plan=social" errorCode={params.error} />
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
