import fs from "node:fs";
import path from "node:path";
import type { CartLine, ReturnCase, StagedItem, WorkOrder } from "@/lib/workspace/engine";
import { pilotWorkspace } from "./pilot.ts";

export type Application = {
  id: string;
  role: "creator" | "supplier";
  email: string;
  name: string;
  status: "pending" | "approved" | "missing";
  missing: string[];
  plan?: "social" | "branded" | "scale";
  warehouseCode?: string;
};

export type CampaignReserve = {
  id: string;
  sellerId: string;
  sku: string;
  quantity: number;
  expiresAt: string;
};

export type AuditEntry = {
  at: string;
  actor: string;
  action: string;
  detail: string;
  role?: string;
  beforeState?: string | null;
  afterState?: string | null;
  reason?: string;
};

export type WorkspaceDb = {
  staged: StagedItem[];
  orders: WorkOrder[];
  returns: ReturnCase[];
  applications: Application[];
  campaigns: CampaignReserve[];
  carts: { ownerId: string; line: CartLine | null }[];
  storefronts: { sellerId: string; policy: string; collection: string }[];
  audit: AuditEntry[];
};

const filePath = path.join(process.cwd(), "data", "dev-workspace.json");

export function emptyWorkspace(): WorkspaceDb {
  return { staged: [], orders: [], returns: [], applications: [], campaigns: [], carts: [], storefronts: [], audit: [] };
}

export function workspaceFromJson(raw: string): WorkspaceDb {
  try {
    const parsed = JSON.parse(raw) as Partial<WorkspaceDb>;
    const empty = emptyWorkspace();
    return { ...empty, ...parsed, staged: parsed.staged ?? [], orders: parsed.orders ?? [], returns: parsed.returns ?? [] };
  } catch {
    return emptyWorkspace();
  }
}

export function readWorkspace(file = filePath): WorkspaceDb {
  try {
    return workspaceFromJson(fs.readFileSync(file, "utf8"));
  } catch {
    return pilotWorkspace();
  }
}

export function writeWorkspace(workspace: WorkspaceDb) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(workspace, null, 2));
}
