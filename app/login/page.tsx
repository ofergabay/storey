import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { SiteHeader } from "@/components/site-header";
import { safeNextPath } from "@/lib/auth/admin";
import { readSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "כניסה",
  description: "כניסה לחשבון ב-Storey.",
};

async function LoginContent({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [session, params] = await Promise.all([readSession(), searchParams]);
  return (
    <>
      <SiteHeader email={session.email} />
      <AuthForm mode="login" nextPath={safeNextPath(params.next)} />
      <p className="hint">
        <a href="/recover">שכחתי את הסיסמה</a>
      </p>
    </>
  );
}

export default function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  return (
    <main className="shell">
      <Suspense fallback={<p className="status">טוען…</p>}>
        <LoginContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
