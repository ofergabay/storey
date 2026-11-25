import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { ExperimentArm, ExperimentId } from "./flags.ts";
import { assignArm } from "./flags.ts";
import type { ShareAngle, ShareLocale } from "./share.ts";

export type SavedLine = {
  creatorId: string;
  productKey: string;
  locale: ShareLocale;
  angle: ShareAngle;
  why: string;
  text: string;
  normalized: string;
  manual: boolean;
};

export type ExperimentStore = {
  arms: { experiment: ExperimentId; subject: string; arm: ExperimentArm }[];
  lines: SavedLine[];
  visits: { id: string; creatorId: string; offerId: string; at: number }[];
  recaps: { creatorId: string; orderId: string }[];
  campaigns: { id: string; creatorId: string; sku: string }[];
};

const file = path.join(process.cwd(), "data", "dev-experiments.json");

export function emptyExperimentStore(): ExperimentStore {
  return { arms: [], lines: [], visits: [], recaps: [], campaigns: [] };
}

export function readExperimentStore(): ExperimentStore {
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as Partial<ExperimentStore>;
    const empty = emptyExperimentStore();
    return {
      arms: parsed.arms ?? empty.arms,
      lines: parsed.lines ?? empty.lines,
      visits: parsed.visits ?? empty.visits,
      recaps: parsed.recaps ?? empty.recaps,
      campaigns: parsed.campaigns ?? empty.campaigns,
    };
  } catch {
    return emptyExperimentStore();
  }
}

export function rememberArm(store: ExperimentStore, experiment: ExperimentId, subject: string, enabled: boolean): { store: ExperimentStore; arm: ExperimentArm; created: boolean } {
  const found = store.arms.find((item) => item.experiment === experiment && item.subject === subject);
  if (found) return { store, arm: found.arm, created: false };
  const arm = assignArm(experiment, subject, enabled);
  return { store: { ...store, arms: [...store.arms, { experiment, subject, arm }] }, arm, created: true };
}

export function writeExperimentStore(store: ExperimentStore): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(store, null, 2));
}
