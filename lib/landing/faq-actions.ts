"use server";

import { revalidatePath } from "next/cache";
import { readAccess } from "@/lib/auth/access";
import { adminPageDecision } from "@/lib/auth/admin-gate";
import { cleanFaqDraft, readLandingFaq, writeLandingFaq, type FaqItem } from "@/lib/landing/faq";

async function allowed(): Promise<boolean> {
  const access = await readAccess();
  return adminPageDecision(access.role) === "allow";
}

function refresh() {
  revalidatePath("/");
}

export async function saveLandingFaq(formData: FormData): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!(await allowed())) return { ok: false, message: "רק ניהול מערכת יכול לערוך שאלות." };
  const draft = cleanFaqDraft({
    id: String(formData.get("id") ?? ""),
    heQ: String(formData.get("heQ") ?? ""),
    heA: String(formData.get("heA") ?? ""),
    enQ: String(formData.get("enQ") ?? ""),
    enA: String(formData.get("enA") ?? ""),
  });
  if (!draft) return { ok: false, message: "צריך שאלה ותשובה בעברית ובאנגלית." };
  const items = readLandingFaq();
  const id = draft.id || `faq-${Date.now()}`;
  const next = items.some((item) => item.id === id)
    ? items.map((item) => (item.id === id ? { ...draft, id } : item))
    : [...items, { ...draft, id }];
  const saved = writeLandingFaq(next);
  if (!saved.ok) return saved;
  refresh();
  return { ok: true };
}

export async function deleteLandingFaq(formData: FormData): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!(await allowed())) return { ok: false, message: "רק ניהול מערכת יכול למחוק שאלות." };
  const id = String(formData.get("id") ?? "");
  const saved = writeLandingFaq(readLandingFaq().filter((item) => item.id !== id));
  if (!saved.ok) return saved;
  refresh();
  return { ok: true };
}

export async function moveLandingFaq(formData: FormData): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!(await allowed())) return { ok: false, message: "רק ניהול מערכת יכול לסדר שאלות." };
  const id = String(formData.get("id") ?? "");
  const direction = Number(formData.get("direction"));
  const items = readLandingFaq();
  const index = items.findIndex((item) => item.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= items.length) return { ok: true };
  const next = [...items];
  const [row] = next.splice(index, 1);
  next.splice(target, 0, row as FaqItem);
  const saved = writeLandingFaq(next);
  if (!saved.ok) return saved;
  refresh();
  return { ok: true };
}
