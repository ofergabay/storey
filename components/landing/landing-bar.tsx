"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { localeCookie } from "@/lib/i18n/locale";
import { landingCopy, menuLinks, type LandingLocale } from "@/lib/landing/copy";

export function LandingBar({ initialLocale = "he" }: { initialLocale?: LandingLocale }) {
  const [locale, setLocale] = useState<LandingLocale>(initialLocale);
  function choose(next: LandingLocale) {
    setLocale(next);
    document.cookie = localeCookie(next);
    document.documentElement.lang = next === "he" ? "he" : "en";
    document.documentElement.dir = next === "he" ? "rtl" : "ltr";
  }
  const [menuOpen, setMenuOpen] = useState(false);
  const text = landingCopy[locale];
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);
  return (
    <div className="storey-landing" lang={locale} dir={locale === "he" ? "rtl" : "ltr"}>
      <header className="storey-nav" dir="ltr">
        <button
          className="storey-menu-button"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="storey-auth-drawer"
          onClick={() => setMenuOpen(true)}
        >
          <span aria-hidden="true">☰</span>
          <span className="sr-only">{text.menuLabel}</span>
        </button>
        <div className="lang-pill" role="group" aria-label={locale === "he" ? "שפה" : "Language"}>
          <button type="button" aria-pressed={locale === "he"} onClick={() => choose("he")}>
            עברית
          </button>
          <span aria-hidden="true">|</span>
          <button type="button" aria-pressed={locale === "en"} onClick={() => choose("en")}>
            English
          </button>
        </div>
        <div className="storey-nav-end">
          <Link className="storey-nav-login" href="/login">
            {text.login}
          </Link>
          <Wordmark href="/" />
        </div>
      </header>
      {menuOpen ? (
        <div className="storey-drawer-layer">
          <button className="storey-drawer-backdrop" type="button" aria-label={text.closeLabel} onClick={() => setMenuOpen(false)} />
          <nav id="storey-auth-drawer" className="storey-drawer" aria-label={text.menuLabel}>
            <button className="storey-quiet" type="button" onClick={() => setMenuOpen(false)}>
              {text.closeLabel}
            </button>
            {menuLinks.map((item) =>
              item.href.includes("#") ? (
                <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>
                  {text[item.key]}
                </a>
              ) : (
                <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>
                  {text[item.key]}
                </Link>
              ),
            )}
          </nav>
        </div>
      ) : null}
    </div>
  );
}
