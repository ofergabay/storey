import { WorkspaceTitle } from "@/components/workspace-title";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "נגישות", description: "הצהרת הנגישות עדיין לא פורסמה." };

export default function AccessibilityPage() {
  return (
    <main className="shell">
      <WorkspaceTitle he="נגישות" en="Accessibility" />
      <p className="status">הצהרת הנגישות עדיין לא פורסמה.</p>
      <Link href="/">חזרה לדף הבית</Link>
    </main>
  );
}
