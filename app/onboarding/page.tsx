import { Suspense } from "react";
import type { Metadata } from "next";
import { RoleNav } from "@/components/role-nav";
import { readAccess } from "@/lib/auth/access";
import { readWorkspace } from "@/lib/workspace/store";
import { submitApplication } from "@/lib/workspace/actions";

export const metadata: Metadata = { title: "השלמת פרטים", description: "סטטוס בקשה ופרטים חסרים." };

async function OnboardingContent({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const [access, query] = await Promise.all([readAccess(), searchParams]);
  const social = query.plan === "social" || readWorkspace().applications.some((item) => item.email === access.email && item.plan === "social");
  const mine = readWorkspace().applications.filter((item) => item.email === access.email);
  const latest = mine[0];
  return (
    <>
      <RoleNav access={access} />
      <h1 className="page-title">השלמת פרטים</h1>
      {social ? <p className="kicker">מכירה חברתית · חינם</p> : null}
      {latest ? (
        <p className="status">
          סטטוס הבקשה: {latest.status === "approved" ? "אושרה" : latest.status === "missing" ? "חסרים פרטים" : "ממתינה לאישור"}
          {latest.missing.length > 0 ? ` · חסר: ${latest.missing.join(", ")}` : ""}
        </p>
      ) : (
        <p>עדיין לא נשלחה בקשה מהחשבון הזה.</p>
      )}
      <form className="auth-form" action={submitApplication}>
        <input type="hidden" name="role" value="creator" />
        {social ? <input type="hidden" name="plan" value="social" /> : null}
        <label htmlFor="join-name">
          שם
          <input id="join-name" name="name" required minLength={2} />
        </label>
        <label htmlFor="join-email">
          אימייל
          <input id="join-email" name="email" type="email" defaultValue={access.email ?? ""} required />
        </label>
        <button className="button-publish" type="submit">
          עדכון הבקשה
        </button>
      </form>
    </>
  );
}

export default function OnboardingPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  return (
    <main className="shell">
      <Suspense fallback={<p className="status">טוען…</p>}>
        <OnboardingContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
