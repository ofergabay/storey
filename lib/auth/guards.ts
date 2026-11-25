import { redirect } from "next/navigation";
import { readAccess, type Access } from "./access";
import { recordAdminInspection } from "./inspection";
import { allowsOperational } from "./permissions";

export async function openSurface(
  surface: "creator" | "supplier",
  nextPath: string,
  inspect: string | undefined,
  options?: { allowAdmin?: boolean },
): Promise<{ access: Access; readOnly: boolean } | { denied: Access }> {
  const access = await readAccess();
  if (access.role === "guest") redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  if (access.role === "admin" && options?.allowAdmin && surface === "creator") return { access, readOnly: false };
  const readOnly = access.role === "admin" && inspect === "1";
  if (!allowsOperational(access.role, surface, readOnly)) return { denied: access };
  if (readOnly) recordAdminInspection(access, nextPath);
  return { access, readOnly };
}
