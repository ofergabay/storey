"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type DevRole = "creator" | "supplier" | "warehouse" | "admin";

const cookieName = "storey_dev_role";

export async function readDevRole(): Promise<DevRole | null> {
  if (process.env.NODE_ENV !== "development") return null;
  const value = (await cookies()).get(cookieName)?.value;
  if (value === "creator" || value === "supplier" || value === "warehouse" || value === "admin") return value;
  return null;
}

export async function setDevRole(role: DevRole | "guest") {
  if (process.env.NODE_ENV !== "development") return;
  const jar = await cookies();
  if (role === "guest") jar.delete(cookieName);
  else jar.set(cookieName, role, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 8 });
  redirect(role === "guest" ? "/" : role === "creator" ? "/studio" : role === "admin" ? "/admin" : "/supplier");
}
