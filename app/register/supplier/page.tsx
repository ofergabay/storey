import { Suspense } from "react";
import type { Metadata } from "next";
import { RoleNav } from "@/components/role-nav";
import { readAccess } from "@/lib/auth/access";
import { submitApplication } from "@/lib/workspace/actions";

export const metadata: Metadata = { title: "הצטרפות כספק", description: "בקשת הצטרפות לספק או למחסן." };

async function SupplierJoin() {
  const access = await readAccess();
  return (
    <>
      <RoleNav access={access} />
      <h1 className="page-title">הצטרפות כספק</h1>
      <p>הבקשה נשמרת כממתינה. אישור ספק ומחסן נעשה במסך האישורים.</p>
      <form className="auth-form" action={submitApplication}>
        <input type="hidden" name="role" value="supplier" />
        <label htmlFor="supplier-name">
          שם העסק
          <input id="supplier-name" name="name" required minLength={2} />
        </label>
        <label htmlFor="supplier-email">
          אימייל
          <input id="supplier-email" name="email" type="email" required />
        </label>
        <button className="button-publish" type="submit">
          שליחת בקשה
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
