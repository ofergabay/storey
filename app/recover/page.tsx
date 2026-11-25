import { WorkspaceTitle } from "@/components/workspace-title";
import { Suspense } from "react";
import type { Metadata } from "next";
import { RecoverForm } from "@/components/recover-form";
import { RoleNav } from "@/components/role-nav";
import { readAccess } from "@/lib/auth/access";
import { pickCopy } from "@/lib/i18n/locale";
import { readLocale } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "שחזור חשבון", description: "איפוס סיסמה." };

async function RecoverContent() {
  const [access, locale] = await Promise.all([readAccess(), readLocale()]);
  return (
    <>
      <RoleNav access={access} />
      <WorkspaceTitle he="שחזור חשבון" en="Account recovery" />
      <p>{pickCopy(locale, "נשלח קישור איפוס אם הכתובת רשומה. לא נציין אם החשבון קיים.", "We'll send a reset link if that address is registered. We won't say whether the account exists.")}</p>
      <RecoverForm locale={locale} />
    </>
  );
}

export default function RecoverPage() {
  return (
    <main className="shell">
      <Suspense fallback={<p className="status">טוען…</p>}>
        <RecoverContent />
      </Suspense>
    </main>
  );
}
