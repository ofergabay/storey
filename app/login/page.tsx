import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthPanel } from "@/components/auth-panel";
import { LandingBar } from "@/components/landing/landing-bar";
import { landingFor, readAccess } from "@/lib/auth/access";
import { readLocale } from "@/lib/i18n/server";
import { sanitizeNextPath } from "@/lib/auth/oauth";

export const metadata: Metadata = {
  title: "כניסה",
  description: "כניסה לחשבון ב-Storey.",
};

async function LoginContent({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const [access, params, locale] = await Promise.all([readAccess(), searchParams, readLocale()]);
  if (access.role !== "guest") redirect(landingFor(access.role));
  return (
    <>
      <LandingBar initialLocale={locale} />
      <AuthPanel mode="login" surface="page" locale={locale} nextPath={sanitizeNextPath(params.next) ?? undefined} errorCode={params.error} />
    </>
  );
}

export default function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  return (
    <main className="shell auth-page">
      <Suspense fallback={<p className="status">טוען…</p>}>
        <LoginContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
