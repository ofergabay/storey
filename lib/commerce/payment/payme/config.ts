import { readFileSync } from "node:fs";
import path from "node:path";
import { PAYME_SANDBOX_BASE, PAYME_SANDBOX_ORIGIN } from "../port.ts";

export type PaymeConfig = {
  env: "sandbox";
  base: typeof PAYME_SANDBOX_BASE;
  clientKey: string;
  clientPassword: string;
  callbackUrl: string;
  returnOrigin: string;
  sellers: Record<string, string>;
};

const sellersFile = path.join(process.cwd(), "data", "dev-payme-sellers.json");

export function isPublicHttps(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local") || host === "0.0.0.0") return false;
    if (host.startsWith("10.") || host.startsWith("127.") || host.startsWith("192.168.")) return false;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

export function sandboxBase(value: string | undefined): typeof PAYME_SANDBOX_BASE | null {
  const base = value && value.length > 0 ? value : PAYME_SANDBOX_BASE;
  try {
    const url = new URL(base);
    if (url.origin !== PAYME_SANDBOX_ORIGIN || !url.pathname.startsWith("/api")) return null;
    return PAYME_SANDBOX_BASE;
  } catch {
    return null;
  }
}

export function readSellerMap(): Record<string, string> {
  try {
    const parsed = JSON.parse(readFileSync(sellersFile, "utf8")) as Record<string, unknown>;
    const sellers: Record<string, string> = {};
    for (const [handle, id] of Object.entries(parsed)) {
      if (typeof id === "string" && id.trim().length > 0) sellers[handle.trim().toLowerCase()] = id.trim();
    }
    return sellers;
  } catch {
    return {};
  }
}

export function readPaymeConfig(
  env: Record<string, string | undefined> = process.env,
  sellers = readSellerMap(),
): { ok: true; config: PaymeConfig } | { ok: false; missing: string[] } {
  const missing: string[] = [];
  if (env.PAYME_ENV !== "sandbox") missing.push("סביבת ארגז חול");
  if (!sandboxBase(env.PAYME_API_BASE)) missing.push("כתובת ארגז החול");
  if (!env.PAYME_CLIENT_KEY) missing.push("מפתח שותף");
  if (!env.PAYME_CLIENT_PASSWORD) missing.push("סיסמת לקוח");
  if (!env.PAYME_CALLBACK_URL || !isPublicHttps(env.PAYME_CALLBACK_URL)) missing.push("כתובת חזרה ציבורית");
  if (!env.PAYME_RETURN_ORIGIN || !isPublicHttps(env.PAYME_RETURN_ORIGIN)) missing.push("כתובת חזרה לדפדפן");
  if (missing.length > 0) return { ok: false, missing };
  return {
    ok: true,
    config: {
      env: "sandbox",
      base: PAYME_SANDBOX_BASE,
      clientKey: env.PAYME_CLIENT_KEY ?? "",
      clientPassword: env.PAYME_CLIENT_PASSWORD ?? "",
      callbackUrl: env.PAYME_CALLBACK_URL ?? "",
      returnOrigin: env.PAYME_RETURN_ORIGIN ?? "",
      sellers,
    },
  };
}

export function sellerPaymeId(config: PaymeConfig, sellerHandle: string): string | null {
  return config.sellers[sellerHandle.trim().toLowerCase()] ?? null;
}

export function paymeConfigMessage(missing: string[]): string {
  return `לא ניתן לפתוח תשלום ב־PayMe. חסר: ${missing.join(", ")}. Storey לא שומרת פרטי כרטיס.`;
}

export function paymePayoutsEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.STOREY_PAYME_PAYOUTS === "approved";
}
