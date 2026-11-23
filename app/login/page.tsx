import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthPanel } from "@/components/auth-panel";
import { SiteHeader } from "@/components/site-header";
import { sanitizeNextPath } from "@/lib/auth/oauth";
import { readSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "כניסה",
  description: "כניסה לחשבון ב-Storey.",
};

async function LoginContent({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const [session, params] = await Promise.all([readSession(), searchParams]);
  return (
    <>
      <SiteHeader email={session.email} />
      <AuthPanel mode="login" surface="page" nextPath={sanitizeNextPath(params.next) ?? undefined} errorCode={params.error} />
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
