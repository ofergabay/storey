import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isDevelopmentAdmin } from "@/lib/auth/admin";
import type { AppRole } from "@/lib/auth/access";
import { routeRedirect } from "@/lib/auth/route-policy";
import { readWorkspace } from "@/lib/workspace/store";

function requestRole(request: NextRequest, email: string | null): AppRole {
  if (process.env.NODE_ENV === "development") {
    const dev = request.cookies.get("storey_dev_role")?.value;
    if (dev === "creator" || dev === "supplier" || dev === "admin") return dev;
  }
  if (!email) return "guest";
  if (isDevelopmentAdmin(email)) return "admin";
  const application = readWorkspace().applications.find((item) => item.email === email && item.status === "approved");
  if (application?.role === "supplier") return "supplier";
  return "creator";
}

export async function proxy(request: NextRequest) {
  const existingVisitor = request.cookies.get("storey_vid")?.value;
  const visitor = existingVisitor ?? crypto.randomUUID();
  if (!existingVisitor) request.cookies.set("storey_vid", visitor);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let response = NextResponse.next({ request });
  const keepVisitor = (target: NextResponse) => {
    target.cookies.set("storey_vid", visitor, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 400 });
    return target;
  };
  let email: string | null = null;
  if (url && key) {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });
    const user = await supabase.auth.getUser();
    email = user.data.user?.email ?? null;
  }

  const destination = routeRedirect({
    pathname: request.nextUrl.pathname,
    role: requestRole(request, email),
    inspect: request.nextUrl.searchParams.get("inspect") === "1",
    preview: request.nextUrl.searchParams.get("preview") === "1",
    unavailable: request.nextUrl.searchParams.get("unavailable") === "1",
    product: request.nextUrl.searchParams.get("product"),
    development: process.env.NODE_ENV === "development",
  });
  if (destination) {
    const next = request.nextUrl.clone();
    const [path, query] = destination.split("?");
    next.pathname = path || "/";
    next.search = query ? `?${query}` : "";
    return keepVisitor(NextResponse.redirect(next));
  }
  return keepVisitor(response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
