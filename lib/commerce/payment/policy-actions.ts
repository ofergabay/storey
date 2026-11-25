"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { readAccess } from "@/lib/auth/access";
import { adminPageDecision } from "@/lib/auth/admin-gate";
import { readPaymentCases, writePaymentCase } from "@/lib/commerce/payment/store";
import { claimTransfer } from "@/lib/commerce/payment/workflow";
import { WEEKLY_POLICY } from "@/lib/commerce/payment/flag";
import { completeWeeklySimulation, runWeeklyBatch } from "@/lib/commerce/payment/weekly";
import { readWorkspace, writeWorkspace } from "@/lib/workspace/store";
import { percentToBasisPoints, publishRates } from "@/lib/commerce/payment/commissions";
import { readCommissions, readTariffs, readWeeklyPayouts, weeklyCutoffFromEnv, writeCommissions, writeTariffs, writeWeeklyPayouts } from "@/lib/commerce/payment/policy-store";
import { publishTariff, retireTariff, type DeliveryService, type TariffRule } from "@/lib/commerce/payment/tariffs";
import { startOfJerusalemDay } from "@/lib/commerce/payment/time";

function shekelsToAgorot(raw: string, allowZero: boolean): number | null {
  const trimmed = raw.trim().replace(/₪/g, "").replace(/\s+/g, "").replace(/,/g, ".");
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole, fraction = ""] = trimmed.split(".");
  const agorot = Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
  if (!Number.isInteger(agorot) || agorot < 0 || (!allowZero && agorot === 0)) return null;
  return agorot;
}

export async function publishCommission(formData: FormData): Promise<void> {
  const access = await readAccess();
  if (adminPageDecision(access.role) !== "allow") redirect("/admin/plans?commission=forbidden");
  const supplierBps = percentToBasisPoints(String(formData.get("supplierPercent") ?? ""));
  const creatorBps = percentToBasisPoints(String(formData.get("creatorPercent") ?? ""));
  const effectiveAt = startOfJerusalemDay(String(formData.get("effectiveOn") ?? ""));
  if (supplierBps === null || creatorBps === null || effectiveAt === null) {
    redirect("/admin/plans?commission=invalid");
  }
  const published = publishRates(readCommissions(), {
    actorRole: access.role,
    actorId: access.userId ?? access.email ?? "admin",
    supplierBps,
    creatorBps,
    effectiveAt,
    now: Date.now(),
  });
  if (!published.ok) redirect(`/admin/plans?commission=${published.code === "FORBIDDEN" ? "forbidden" : "invalid"}`);
  writeCommissions(published.book);
  revalidatePath("/admin/plans");
  revalidatePath("/catalog");
  redirect("/admin/plans?commission=published");
}

export async function saveTariff(formData: FormData): Promise<void> {
  const access = await readAccess();
  if (access.role !== "supplier") redirect("/supplier/settings?tariff=forbidden");
  const supplierId = access.userId ?? "";
  const price = shekelsToAgorot(String(formData.get("price") ?? ""), true);
  const effectiveFrom = startOfJerusalemDay(String(formData.get("effectiveOn") ?? ""));
  const service = String(formData.get("service") ?? "");
  const coverageKind = String(formData.get("coverage") ?? "");
  const windowMin = Number(formData.get("windowMin") ?? "");
  const windowMax = Number(formData.get("windowMax") ?? "");
  const cutoffHour = Number(formData.get("cutoff") ?? "");
  if (price === null || effectiveFrom === null) redirect("/supplier/settings?tariff=invalid");
  if (!["standard", "express", "pickup"].includes(service)) redirect("/supplier/settings?tariff=invalid");
  if (!["postcode", "city", "zone", "nationwide"].includes(coverageKind)) redirect("/supplier/settings?tariff=invalid");
  const warehouseCode = String(formData.get("warehouse") ?? "");
  if (warehouseCode !== "PILOT-01") redirect("/supplier/settings?tariff=warehouse");
  const bandMin = String(formData.get("bandMin") ?? "").trim();
  const bandPrice = String(formData.get("bandPrice") ?? "").trim();
  const bulkyCm = String(formData.get("bulkyCm") ?? "").trim();
  const freeAt = String(formData.get("freeAt") ?? "").trim();
  const rule: TariffRule = {
    id: `tariff-${Date.now()}`,
    supplierId,
    warehouseCode,
    service: service as DeliveryService,
    coverage: { kind: coverageKind as TariffRule["coverage"]["kind"], value: String(formData.get("coverageValue") ?? "") },
    priceAgorot: price,
    windowMinDays: windowMin,
    windowMaxDays: windowMax,
    cutoffHour,
    effectiveFrom,
    effectiveTo: null,
    status: "draft",
    version: 1,
  };
  if (bandMin && bandPrice) {
    const minGrams = Number(bandMin);
    const maxRaw = String(formData.get("bandMax") ?? "").trim();
    const priced = shekelsToAgorot(bandPrice, true);
    if (!Number.isInteger(minGrams) || priced === null) redirect("/supplier/settings?tariff=invalid");
    rule.weightBands = [{ minGrams, maxGrams: maxRaw ? Number(maxRaw) : null, priceAgorot: priced }];
  }
  if (bulkyCm) {
    const surcharge = shekelsToAgorot(String(formData.get("bulkyPrice") ?? ""), true);
    if (surcharge === null) redirect("/supplier/settings?tariff=invalid");
    rule.bulkyMinCm = Number(bulkyCm);
    rule.bulkySurchargeAgorot = surcharge;
  }
  if (freeAt) {
    const threshold = shekelsToAgorot(freeAt, true);
    if (threshold === null) redirect("/supplier/settings?tariff=invalid");
    rule.freeThresholdAgorot = threshold;
  }
  const publish = String(formData.get("intent") ?? "") === "publish";
  const current = readTariffs();
  if (!publish) {
    writeTariffs([...current, rule]);
    revalidatePath("/supplier/settings");
    redirect("/supplier/settings?tariff=draft");
  }
  const published = publishTariff(current, rule);
  if (!published.ok) redirect(`/supplier/settings?tariff=${published.code === "OVERLAP" ? "overlap" : "invalid"}`);
  writeTariffs(published.rules);
  revalidatePath("/supplier/settings");
  revalidatePath("/s");
  redirect("/supplier/settings?tariff=published");
}

export async function publishStoredTariff(formData: FormData): Promise<void> {
  const access = await readAccess();
  if (access.role !== "supplier") redirect("/supplier/settings?tariff=forbidden");
  const id = String(formData.get("id") ?? "");
  const rule = readTariffs().find((item) => item.id === id && item.supplierId === access.userId);
  if (!rule) redirect("/supplier/settings?tariff=missing");
  const published = publishTariff(readTariffs(), rule);
  if (!published.ok) redirect(`/supplier/settings?tariff=${published.code === "OVERLAP" ? "overlap" : "invalid"}`);
  writeTariffs(published.rules);
  revalidatePath("/supplier/settings");
  redirect("/supplier/settings?tariff=published");
}

export async function retireStoredTariff(formData: FormData): Promise<void> {
  const access = await readAccess();
  if (access.role !== "supplier") redirect("/supplier/settings?tariff=forbidden");
  const retired = retireTariff(readTariffs(), String(formData.get("id") ?? ""), Date.now(), access.userId ?? "");
  if (!retired.ok) redirect("/supplier/settings?tariff=missing");
  writeTariffs(retired.rules);
  revalidatePath("/supplier/settings");
  redirect("/supplier/settings?tariff=retired");
}

export async function runLocalWeeklyPayout(): Promise<void> {
  const access = await readAccess();
  if (adminPageDecision(access.role) !== "allow") redirect("/admin/finance");
  const now = Date.now();
  const workspace = readWorkspace();
  const cases = readPaymentCases();
  const actor = access.userId ?? access.email ?? "admin";
  const orders = cases.flatMap((item) => {
    const order = workspace.orders.find((row) => row.id === item.state.id && row.policyVersion === WEEKLY_POLICY);
    if (!order || order.previewSale || order.status === "failed" || order.status === "cancelled") return [];
    if (item.state.policyVersion !== WEEKLY_POLICY || item.state.status !== "captured") return [];
    if (item.state.units.every((unit) => unit.refunded || unit.dispute === "open")) return [];
    return [{ id: order.id, creatorId: order.sellerHandle, state: item.state, providerAvailable: true as const }];
  });
  const existing = readWeeklyPayouts();
  const batch = runWeeklyBatch({ orders, now, cutoff: weeklyCutoffFromEnv(), existing });
  const created = batch.created.map((instruction) => ({ ...instruction, makerId: actor }));
  const saved = [...existing];
  for (const instruction of created) {
    const updates: { caseId: string; state: (typeof cases)[number]["state"] }[] = [];
    let failed = false;
    for (const order of orders) {
      if (!instruction.lines.some((line) => line.orderId === order.id)) continue;
      const claimed = claimTransfer(order.state, {
        key: instruction.key,
        now,
        party: instruction.party,
        supplierId: instruction.party === "supplier" ? instruction.beneficiaryId : undefined,
      });
      if (!claimed.ok) {
        failed = true;
        break;
      }
      updates.push({ caseId: order.id, state: claimed.state });
      order.state = claimed.state;
    }
    if (failed) continue;
    for (const update of updates) {
      const current = cases.find((item) => item.state.id === update.caseId);
      if (current) writePaymentCase({ ...current, state: update.state });
    }
    saved.push(instruction);
  }
  writeWeeklyPayouts(saved);
  workspace.audit.unshift({
    at: new Date(now).toISOString(),
    actor,
    action: "weekly-instruct",
    detail: created.length === 0 ? "none" : created.map((item) => `${item.key}:${item.amount}`).join(" "),
  });
  writeWorkspace(workspace);
  revalidatePath("/admin/finance");
  revalidatePath("/earnings");
  revalidatePath("/supplier/settlements");
  redirect("/admin/finance?weekly=ran");
}

export async function confirmLocalWeeklyBank(formData: FormData): Promise<void> {
  const access = await readAccess();
  if (adminPageDecision(access.role) !== "allow") redirect("/admin/finance");
  const key = String(formData.get("key") ?? "");
  const instructions = readWeeklyPayouts();
  const instruction = instructions.find((item) => item.key === key && item.status === "instructed");
  if (!instruction) redirect("/admin/finance?weekly=missing");
  const actor = access.userId ?? access.email ?? "admin";
  writeWeeklyPayouts(completeWeeklySimulation(instructions, key));
  const workspace = readWorkspace();
  workspace.audit.unshift({
    at: new Date().toISOString(),
    actor,
    action: "weekly-simulate",
    detail: `${key}:simulated`,
  });
  writeWorkspace(workspace);
  revalidatePath("/admin/finance");
  revalidatePath("/earnings");
  revalidatePath("/supplier/settlements");
  redirect("/admin/finance?weekly=simulated");
}
