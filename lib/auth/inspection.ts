import type { Access } from "./access";
import { readWorkspace, writeWorkspace } from "@/lib/workspace/store";

export function recordAdminInspection(access: Access, path: string) {
  if (access.role !== "admin") return;
  const workspace = readWorkspace();
  const actor = access.email ?? access.userId ?? "admin";
  const latest = workspace.audit[0];
  if (latest?.actor === actor && latest.action === "admin-inspect" && latest.detail === path) return;
  workspace.audit.unshift({
    at: new Date().toISOString(),
    actor,
    action: "admin-inspect",
    detail: path,
  });
  writeWorkspace(workspace);
}
