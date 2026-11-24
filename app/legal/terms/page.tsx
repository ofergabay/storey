import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal-document";

export const metadata: Metadata = {
  title: "תנאי שימוש",
  description: "מסמך תנאי השימוש עדיין לא פורסם.",
};

export default function TermsPage() {
  return (
    <LegalDocument
      title="תנאי שימוש"
      englishTitle="Terms of use"
      body="מסמך תנאי השימוש עדיין לא פורסם. אין כאן תנאים מחייבים."
      englishBody="The terms of use have not been published. This page is not a binding agreement."
    />
  );
}
