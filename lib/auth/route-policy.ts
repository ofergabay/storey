import type { AppRole } from "./access.ts";
import { isCreatorPricingPath, sanitizeProductId } from "./oauth.ts";

function homeFor(role: AppRole): string {
  if (role === "admin") return "/admin/staging";
  if (role === "supplier") return "/supplier";
  if (role === "creator") return "/earnings";
  return "/";
}

const creatorRoots = ["/earnings", "/catalog", "/studio", "/listings", "/orders", "/account", "/storefront", "/campaigns"];

export function surfaceForPath(pathname: string): "creator" | "supplier" | "admin" | "auth" | "plans" | null {
  if (pathname === "/login" || pathname === "/register") return "auth";
  if (pathname === "/plans") return "plans";
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "admin";
  if (pathname === "/supplier" || pathname.startsWith("/supplier/")) return "supplier";
  if (creatorRoots.some((root) => pathname === root || pathname.startsWith(`${root}/`))) return "creator";
  return null;
}

export function routeRedirect(input: {
  pathname: string;
  role: AppRole;
  inspect: boolean;
  development: boolean;
  preview?: boolean;
  unavailable?: boolean;
  product?: string | null;
}): string | null {
  if (input.pathname === "/catalog/start") return null;
  if (input.pathname === "/") {
    const product = sanitizeProductId(input.product);
    if (product && (input.role === "creator" || input.role === "admin")) {
      return `/catalog/start?product=${encodeURIComponent(product)}`;
    }
    if (input.role === "guest" || (input.role === "admin" && input.preview)) return null;
    return homeFor(input.role);
  }
  if (input.pathname === "/dev" || input.pathname.startsWith("/dev/")) {
    return input.development ? null : "/";
  }
  const surface = surfaceForPath(input.pathname);
  if (surface === "auth" || surface === "plans") {
    return input.role === "guest" ? null : homeFor(input.role);
  }
  if (!surface) return null;
  if (input.role === "guest") return `/login?next=${encodeURIComponent(input.pathname)}`;
  if (input.role === "admin" && input.unavailable && input.pathname === "/catalog") return null;
  if (input.role === "admin" && isCreatorPricingPath(input.pathname)) return null;
  if (surface === "admin") return input.role === "admin" ? null : homeFor(input.role);
  if (input.role === surface) return null;
  if (input.role === "admin" && input.inspect) return null;
  return homeFor(input.role);
}
