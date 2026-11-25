import { WorkspaceTitle } from "@/components/workspace-title";
import { Suspense } from "react";
import type { Metadata } from "next";
import { FaqAdmin } from "@/components/landing/faq-admin";
import { Denied, RoleNav } from "@/components/role-nav";
import { requireAdminPage } from "@/lib/auth/admin-gate";
import { readLandingFaq } from "@/lib/landing/faq";

export const metadata: Metadata = { title: "שאלות נפוצות", description: "עריכת שאלות דף הבית." };

async function FaqContent() {
  const gate = await requireAdminPage("/admin/faq");
  if (!gate.admin) return <Denied access={gate.access} />;
  const access = gate.access;
  return (
    <>
      <RoleNav access={access} />
      <WorkspaceTitle he="שאלות נפוצות" en="FAQ" />
      <p className="hint">הוספה, עריכה, מחיקה וסידור נשמרים רק לניהול מערכת. הפעולות נבדקות שוב בשרת.</p>
      <FaqAdmin faqs={readLandingFaq()} />
    </>
  );
}

export default function AdminFaqPage() {
  return (
    <main className="shell">
      <Suspense fallback={<p className="status">טוען…</p>}>
        <FaqContent />
      </Suspense>
    </main>
  );
}
