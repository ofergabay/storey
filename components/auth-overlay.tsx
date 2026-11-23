"use client";

import { useEffect, useId, useState } from "react";
import { AuthPanel } from "@/components/auth-panel";
import type { AuthIntent } from "@/lib/auth/oauth";
import type { LandingLocale } from "@/lib/landing/copy";

export function AuthOverlay({
  open,
  mode,
  locale,
  errorCode,
  returnFocus,
  onClose,
}: {
  open: boolean;
  mode: AuthIntent;
  locale: LandingLocale;
  errorCode?: string | null;
  returnFocus: HTMLElement | null;
  onClose: () => void;
}) {
  if (!open) return null;
  return <AuthDialog key={mode} mode={mode} locale={locale} errorCode={errorCode} returnFocus={returnFocus} onClose={onClose} />;
}

function AuthDialog({
  mode,
  locale,
  errorCode,
  returnFocus,
  onClose,
}: {
  mode: AuthIntent;
  locale: LandingLocale;
  errorCode?: string | null;
  returnFocus: HTMLElement | null;
  onClose: () => void;
}) {
  const titleId = useId();
  const [currentMode, setCurrentMode] = useState(mode);

  useEffect(() => {
    const root = document.getElementById("storey-auth-dialog");
    const previous = returnFocus;
    const focusable = () =>
      root
        ? [...root.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input:not([disabled]), textarea, select")].filter(
            (element) => !element.hasAttribute("hidden"),
          )
        : [];
    const frame = window.requestAnimationFrame(() => {
      root?.querySelector<HTMLElement>(".auth-google")?.focus();
    });
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    const scrollY = window.scrollY;
    document.documentElement.classList.add("auth-open");
    document.addEventListener("keydown", onKey);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
      document.documentElement.classList.remove("auth-open");
      window.scrollTo(0, scrollY);
      previous?.focus();
    };
  }, [onClose, returnFocus]);

  return (
    <div
      className="auth-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div id="storey-auth-dialog" className="auth-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} dir={locale === "he" ? "rtl" : "ltr"}>
        <button className="auth-close" type="button" onClick={onClose} aria-label={locale === "he" ? "סגירה" : "Close"}>
          ×
        </button>
        <AuthPanel
          key={currentMode}
          mode={currentMode}
          surface="landing"
          locale={locale}
          errorCode={currentMode === mode ? errorCode : null}
          titleId={titleId}
          nextPath={currentMode === "register" ? "/onboarding?plan=social" : undefined}
          onModeChange={setCurrentMode}
        />
      </div>
    </div>
  );
}
