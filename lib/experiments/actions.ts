"use server";

import { revalidatePath } from "next/cache";
import { readExperimentStore, writeExperimentStore, type SavedLine } from "@/lib/experiments/store";
import { claimPunchline, normalizeLine, tooSimilar, type OfferFacts, type ShareAngle, type ShareLocale } from "@/lib/experiments/share";
import { freshCampaignId } from "@/lib/experiments/pace";
import { redirect } from "next/navigation";

export async function saveShareLine(input: {
  creatorId: string;
  productKey: string;
  sku: string;
  locale: ShareLocale;
  angle: ShareAngle;
  why: string;
  text: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const text = input.text.trim();
  if (text.length < 2) return { ok: false, message: "צריך שורה שאפשר לשתף." };
  const store = readExperimentStore();
  const normalized = normalizeLine(text);
  const next: SavedLine = {
    creatorId: input.creatorId,
    productKey: input.productKey,
    locale: input.locale,
    angle: input.angle,
    why: input.why,
    text,
    normalized,
    manual: true,
  };
  store.lines = [...store.lines.filter((line) => !sameDraft(line, input.creatorId, input.productKey, input.locale)), next];
  writeExperimentStore(store);
  revalidatePath(`/catalog/${input.sku}`);
  return { ok: true };
}

export async function replaceShareLine(input: {
  creatorId: string;
  productKey: string;
  sku: string;
  locale: ShareLocale;
  angle: ShareAngle;
  why: string;
  facts: OfferFacts;
  attempt: number;
}): Promise<{ ok: true; text: string } | { ok: false; message: string }> {
  const store = readExperimentStore();
  const taken = store.lines
    .filter((line) => line.productKey === input.productKey && line.locale === input.locale && !(line.creatorId === input.creatorId && line.productKey === input.productKey))
    .map((line) => line.normalized);
  const claimed = new Set<string>();
  const next = claimPunchline({ ...input, taken }, claimed);
  if (!next.text || !next.normalized) return { ok: false, message: "נגמרו ניסוחים שונים. אפשר לכתוב שורה משלך." };
  const text = next.text;
  const normalized = next.normalized;
  if (store.lines.some((line) => line.productKey === input.productKey && line.locale === input.locale && (line.normalized === normalized || tooSimilar(line.text, text)))) {
    return { ok: false, message: "השורה קרובה מדי לשורה קיימת. אפשר לכתוב ניסוח משלך." };
  }
  store.lines = [
    ...store.lines.filter((line) => !sameDraft(line, input.creatorId, input.productKey, input.locale)),
    { creatorId: input.creatorId, productKey: input.productKey, locale: input.locale, angle: input.angle, why: input.why, text, normalized, manual: false },
  ];
  writeExperimentStore(store);
  revalidatePath(`/catalog/${input.sku}`);
  return { ok: true, text: next.text };
}

export async function duplicateOfferCampaign(input: { creatorId: string; sku: string }): Promise<{ id: string }> {
  const store = readExperimentStore();
  const id = freshCampaignId(store.campaigns.map((item) => item.id), Date.now());
  store.campaigns.unshift({ id, creatorId: input.creatorId, sku: input.sku });
  writeExperimentStore(store);
  revalidatePath("/earnings");
  return { id };
}

export async function duplicateCampaignForm(formData: FormData): Promise<void> {
  const creatorId = String(formData.get("creatorId") ?? "");
  const sku = String(formData.get("sku") ?? "");
  const { id } = await duplicateOfferCampaign({ creatorId, sku });
  redirect(`/catalog/${sku}?campaign=${id}`);
}

export async function ensureShareLine(input: {
  creatorId: string;
  productKey: string;
  sku: string;
  locale: ShareLocale;
  angle: ShareAngle;
  why: string;
  facts: OfferFacts;
}): Promise<SavedLine | null> {
  const store = readExperimentStore();
  const current = store.lines.find((line) => sameDraft(line, input.creatorId, input.productKey, input.locale));
  if (current) return current;
  const taken = store.lines.filter((line) => line.productKey === input.productKey && line.locale === input.locale).map((line) => line.normalized);
  const next = claimPunchline({ ...input, taken, attempt: 0 }, new Set<string>());
  if (!next.text || !next.normalized) return null;
  const saved: SavedLine = {
    creatorId: input.creatorId,
    productKey: input.productKey,
    locale: input.locale,
    angle: input.angle,
    why: input.why,
    text: next.text,
    normalized: next.normalized,
    manual: false,
  };
  store.lines = [...store.lines, saved];
  writeExperimentStore(store);
  return saved;
}

function sameDraft(line: SavedLine, creatorId: string, productKey: string, locale: ShareLocale): boolean {
  return line.creatorId === creatorId && line.productKey === productKey && line.locale === locale;
}
