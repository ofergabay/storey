"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type DevRole = "creator" | "supplier" | "admin";

const cookieName = "storey_dev_role";

export async function readDevRole(): Promise<DevRole | null> {
  const { developmentRole } = await import("./can");
  const value = (await cookies()).get(cookieName)?.value;
  return developmentRole(process.env.NODE_ENV, value);
}

export async function setDevRole(role: DevRole | "guest") {
  if (process.env.NODE_ENV !== "development") return;
  const jar = await cookies();
  if (role === "guest") jar.delete(cookieName);
  else jar.set(cookieName, role, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 8 });
  redirect(role === "guest" ? "/" : role === "creator" ? "/earnings" : role === "admin" ? "/admin/staging" : "/supplier");
}
