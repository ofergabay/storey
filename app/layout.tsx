import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Rubik } from "next/font/google";
import { readLocale } from "@/lib/i18n/server";
import "./globals.css";

const rubik = Rubik({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const instant = false;

export const metadata: Metadata = {
  title: {
    default: "Storey",
    template: "%s · Storey",
  },
  description: "מכירת ערכות מסיבה בקישור.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await readLocale();
  return (
    <html lang={locale === "en" ? "en" : "he"} dir={locale === "en" ? "ltr" : "rtl"} className={rubik.className}>
      <body>{children}</body>
    </html>
  );
}
