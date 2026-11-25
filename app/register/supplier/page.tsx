import { WorkspaceTitle } from "@/components/workspace-title";
import { Suspense } from "react";
import type { Metadata } from "next";
import { RoleNav } from "@/components/role-nav";
import { readAccess } from "@/lib/auth/access";
import { pickCopy } from "@/lib/i18n/locale";
import { readLocale } from "@/lib/i18n/server";
import { submitApplication } from "@/lib/workspace/actions";

export const metadata: Metadata = { title: "הצטרפות כספק", description: "בקשת הצטרפות לספק או למחסן." };

async function SupplierJoin() {
  const [access, locale] = await Promise.all([readAccess(), readLocale()]);
  return (
    <>
      <RoleNav access={access} />
      <WorkspaceTitle he="הצטרפות כספק" en="Apply as a supplier" />
      <p>{pickCopy(locale, "הבקשה נשמרת כממתינה. אישור ספק ומחסן נעשה במסך האישורים.", "The request stays pending. A supplier and warehouse are approved on the approvals screen.")}</p>
      <form className="auth-form" action={submitApplication}>
        <input type="hidden" name="role" value="supplier" />
        <label htmlFor="supplier-name">
          {pickCopy(locale, "שם העסק", "Business name")}
          <input id="supplier-name" name="name" required minLength={2} />
        </label>
        <label htmlFor="supplier-email">
          {pickCopy(locale, "אימייל", "Email")}
          <input id="supplier-email" name="email" type="email" required />
        </label>
        <button className="button-publish" type="submit">
          {pickCopy(locale, "שליחת בקשה", "Send the request")}
        </button>
      </form>
    </>
  );
}

export default function SupplierRegisterPage() {
  return (
    <main className="shell">
      <Suspense fallback={<p className="status">טוען…</p>}>
        <SupplierJoin />
      </Suspense>
    </main>
  );
}
