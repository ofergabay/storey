"use client";

import { useRouter } from "next/navigation";
import { localeCookie, type Locale } from "@/lib/i18n/locale";

export function LocaleSwitch({ locale }: { locale: Locale }) {
  const router = useRouter();
  function choose(next: Locale) {
    document.cookie = localeCookie(next);
    document.documentElement.lang = next === "en" ? "en" : "he";
    document.documentElement.dir = next === "en" ? "ltr" : "rtl";
    router.refresh();
  }
  return (
    <div className="lang-pill" role="group" aria-label={locale === "he" ? "שפה" : "Language"}>
      <button type="button" aria-pressed={locale === "he"} onClick={() => choose("he")}>
        עברית
      </button>
      <span aria-hidden="true">|</span>
      <button type="button" aria-pressed={locale === "en"} onClick={() => choose("en")}>
        English
      </button>
    </div>
  );
}
