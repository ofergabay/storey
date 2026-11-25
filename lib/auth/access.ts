import { isDevelopmentAdmin } from "@/lib/auth/admin";
import { readDevRole, type DevRole } from "@/lib/auth/dev-role";
import { readSession } from "@/lib/session";
import { readWorkspace } from "@/lib/workspace/store";

export type AppRole = "guest" | DevRole;

export type Access = {
  role: AppRole;
  email: string | null;
  userId: string | null;
  name: string;
};

export async function readAccess(): Promise<Access> {
  const dev = await readDevRole();
  if (dev) {
    return { role: dev, email: `${dev}@dev.local`, userId: `dev-${dev}`, name: dev };
  }
  const session = await readSession();
  if (!session.userId) return { role: "guest", email: null, userId: null, name: "" };
  if (isDevelopmentAdmin(session.email)) {
    return { role: "admin", email: session.email, userId: session.userId, name: session.email ?? "admin" };
  }
  const application = readWorkspace().applications.find((item) => item.email === session.email && item.status === "approved");
  const role = application?.role === "supplier" ? "supplier" : "creator";
  return { role, email: session.email, userId: session.userId, name: application?.name || session.email || "creator" };
}

export function landingFor(role: AppRole): string {
  if (role === "admin") return "/admin/staging";
  if (role === "supplier") return "/supplier";
  if (role === "creator") return "/earnings";
  return "/";
}
