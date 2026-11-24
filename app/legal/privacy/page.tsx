import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal-document";

export const metadata: Metadata = {
  title: "פרטיות",
  description: "מסמך הפרטיות עדיין לא פורסם.",
};

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="פרטיות"
      englishTitle="Privacy"
      body="מסמך הפרטיות עדיין לא פורסם. אין כאן מדיניות מחייבת."
      englishBody="The privacy document has not been published. This page is not a binding policy."
    />
  );
}
