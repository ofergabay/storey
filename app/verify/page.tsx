import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "אימות אימייל", description: "החשבון ממתין לאישור אימייל." };

export default function VerifyPage() {
  return (
    <main className="shell">
      <h1 className="page-title">אימות אימייל</h1>
      <p className="status">שלחנו אימייל לאישור החשבון. אחרי האישור אפשר להיכנס. אין כניסה לפני האימות.</p>
      <Link href="/login">כניסה</Link>
    </main>
  );
}
