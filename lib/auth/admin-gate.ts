import { redirect } from "next/navigation";
import { adminPageDecision } from "./admin-decision";
import { readAccess, type Access } from "./access";

export { adminPageDecision } from "./admin-decision";

export async function requireAdminPage(nextPath: string): Promise<{ access: Access; admin: true } | { access: Access; admin: false }> {
  const access = await readAccess();
  const decision = adminPageDecision(access.role);
  if (decision === "login") redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  if (decision === "deny") return { access, admin: false };
  return { access, admin: true };
}
