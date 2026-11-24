export type Locale = "he" | "en";

export const LOCALE_COOKIE = "storey_locale";

export function parseLocale(value: string | undefined | null): Locale {
  return value === "en" ? "en" : "he";
}

export function localeCookie(locale: Locale): string {
  return `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function pickCopy(locale: Locale, he: string, en?: string): string {
  if (locale === "en" && en) return en;
  return he;
}
