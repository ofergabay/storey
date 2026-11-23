import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { SiteHeader } from "@/components/site-header";
import { readSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "הרשמה",
  description: "פתיחת חשבון יוצר ב-Storey.",
};

async function RegisterContent() {
  const session = await readSession();
  return (
    <>
      <SiteHeader email={session.email} />
      <AuthForm mode="register" nextPath="/catalog" />
    </>
  );
}

export default function RegisterPage() {
  return (
    <main className="shell">
      <Suspense fallback={<p className="status">טוען…</p>}>
        <RegisterContent />
      </Suspense>
    </main>
  );
}
