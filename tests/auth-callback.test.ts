import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { adminPageDecision } from "../lib/auth/admin-decision.ts";
import {
  completeGoogleCallback,
  creatorAccountFacts,
  type AccountApplication,
  type StoredProfile,
} from "../lib/auth/callback.ts";
import { developmentRole } from "../lib/auth/can.ts";
import {
  onboardingDestination,
  productEntryDestination,
  productUnavailableHe,
  productUnavailablePath,
} from "../lib/auth/oauth.ts";
import { navigationFor } from "../lib/auth/permissions.ts";
import { routeRedirect } from "../lib/auth/route-policy.ts";

const now = Date.parse("2026-11-24T12:00:00.000Z");
const freshAt = "2026-11-24T11:59:30.000Z";
const returningAt = "2026-11-01T00:00:00.000Z";
const party = [{ sku: "PARTY-01" }];
const root = path.resolve(import.meta.dirname, "..");

function creatorApplication(email: string): AccountApplication {
  return { email, role: "creator", status: "pending", name: "נועה" };
}

async function googleCallback(input: {
  email: string;
  createdAt: string;
  cookies: Record<string, string>;
  developmentAdmin?: boolean;
  applications?: AccountApplication[];
  products?: { sku: string }[];
  listings?: { sku: string; slug: string }[];
}) {
  const saved: StoredProfile[] = [];
  const request = new Request(`https://storey-ofergabay.vercel.app/auth/callback?code=google-code`, {
    headers: { cookie: Object.entries(input.cookies).map(([name, value]) => `${name}=${value}`).join("; ") },
  });
  const response = await completeGoogleCallback(request, {
    cookie: (name) => input.cookies[name],
    now: () => now,
    products: () => input.products ?? party,
    listings: () => input.listings ?? [],
    exchange: async (code) => {
      assert.equal(code, "google-code");
      return {
        user: { id: "user-1", email: input.email, created_at: input.createdAt },
        error: false,
        cookies: [{ name: "sb-access-token", value: "session", options: { path: "/", httpOnly: true } }],
      };
    },
    accountFacts: (user) =>
      creatorAccountFacts({
        email: user.email,
        developmentAdmin: input.developmentAdmin ?? false,
        applications: input.applications ?? [],
      }),
    saveProfile: (profile) => {
      saved.push(profile);
    },
  });
  const location = response.headers.get("location");
  assert.ok(location);
  const url = new URL(location);
  return { path: `${url.pathname}${url.search}`, saved, response };
}

test("a fresh Google signup keeps the party product and does not become an admin", async () => {
  const result = await googleCallback({
    email: "new-creator@example.com",
    createdAt: freshAt,
    cookies: {
      storey_auth_intent: "register",
      storey_auth_from: "landing",
      storey_auth_product: "party-01",
      storey_auth_next: encodeURIComponent("/admin/staging"),
      storey_dev_role: "admin",
    },
  });
  assert.equal(result.path, "/onboarding?plan=social&product=party-01");
  assert.equal(result.saved.length, 1);
  assert.equal(result.saved[0]?.role, "creator");
  assert.equal(result.saved[0]?.onboarded, false);
  assert.equal(navigationFor("creator", false).some((item) => item.href.startsWith("/admin")), false);
  assert.equal(developmentRole("production", "admin"), null);
});

test("first-time onboarding carries the product and completion opens its pricing screen", async () => {
  const arriving = await googleCallback({
    email: "new-creator@example.com",
    createdAt: freshAt,
    cookies: {
      storey_auth_intent: "register",
      storey_auth_from: "landing",
      storey_auth_product: "party-01",
    },
  });
  assert.equal(arriving.path, "/onboarding?plan=social&product=party-01");
  assert.equal(onboardingDestination("party-01", { products: party }), "/catalog/PARTY-01");

  const finished = await googleCallback({
    email: "new-creator@example.com",
    createdAt: freshAt,
    applications: [creatorApplication("new-creator@example.com")],
    cookies: {
      storey_auth_intent: "register",
      storey_auth_from: "landing",
      storey_auth_product: "party-01",
    },
  });
  assert.equal(finished.path, "/catalog/PARTY-01");
  assert.equal(finished.saved.length, 0);
});

test("an existing creator returns to the selected product pricing screen", async () => {
  const result = await googleCallback({
    email: "maya@example.com",
    createdAt: returningAt,
    applications: [creatorApplication("maya@example.com")],
    listings: [{ sku: "PARTY-01", slug: "party-01" }],
    cookies: {
      storey_auth_intent: "login",
      storey_auth_from: "landing",
      storey_auth_product: "party-01",
    },
  });
  assert.equal(result.path, "/catalog/PARTY-01");
  assert.equal(result.saved.length, 0);
  assert.equal(productEntryDestination("creator", "party-01", { products: party }), "/catalog/PARTY-01");

  const fromReturnPath = await googleCallback({
    email: "maya@example.com",
    createdAt: returningAt,
    applications: [creatorApplication("maya@example.com")],
    cookies: {
      storey_auth_intent: "login",
      storey_auth_next: encodeURIComponent("/catalog/PARTY-01"),
    },
  });
  assert.equal(fromReturnPath.path, "/catalog/PARTY-01");
});

test("an admin who starts the creator flow resumes pricing and keeps the admin role", async () => {
  const result = await googleCallback({
    email: "ofergabay@gmail.com",
    createdAt: returningAt,
    developmentAdmin: true,
    cookies: {
      storey_auth_intent: "register",
      storey_auth_from: "landing",
      storey_auth_product: "party-01",
      storey_auth_next: encodeURIComponent("/admin/staging"),
    },
  });
  assert.equal(result.path, "/catalog/PARTY-01");
  assert.equal(result.saved[0]?.role, "admin");
  assert.equal(routeRedirect({ pathname: "/admin/staging", role: "admin", inspect: false, development: false }), null);
  assert.equal(routeRedirect({ pathname: "/catalog/PARTY-01", role: "admin", inspect: false, development: false }), null);
  assert.equal(productEntryDestination("admin", "party-01", { products: party }), "/catalog/PARTY-01");

  const home = await googleCallback({
    email: "ofergabay@gmail.com",
    createdAt: returningAt,
    developmentAdmin: true,
    cookies: {
      storey_auth_intent: "register",
      storey_auth_from: "landing",
      storey_auth_next: encodeURIComponent("/onboarding?plan=social"),
      storey_dev_role: "admin",
    },
  });
  assert.equal(home.path, "/admin/staging");
});

test("an unavailable product opens the creator catalog with a Hebrew explanation", async () => {
  const result = await googleCallback({
    email: "maya@example.com",
    createdAt: returningAt,
    applications: [creatorApplication("maya@example.com")],
    products: [],
    cookies: {
      storey_auth_intent: "login",
      storey_auth_product: "party-01",
    },
  });
  assert.equal(result.path, productUnavailablePath);
  assert.match(productUnavailableHe, /המוצר שבחרתם כבר לא זמין/);
  assert.match(productUnavailableHe, /הקטלוג/);
  const catalogPage = fs.readFileSync(path.join(root, "app/catalog/page.tsx"), "utf8");
  assert.match(catalogPage, /productUnavailableHe/);
  assert.equal(onboardingDestination("party-01", { products: [] }), productUnavailablePath);
});

test("a creator requesting /admin/staging directly is refused and receives no admin shell", async () => {
  const result = await googleCallback({
    email: "maya@example.com",
    createdAt: returningAt,
    applications: [creatorApplication("maya@example.com")],
    cookies: {
      storey_auth_intent: "login",
      storey_auth_next: encodeURIComponent("/admin/staging"),
      storey_dev_role: "admin",
    },
  });
  assert.equal(result.path, "/earnings");
  assert.equal(result.saved.length, 0);
  assert.equal(routeRedirect({ pathname: "/admin/staging", role: "creator", inspect: false, development: false }), "/earnings");
  assert.equal(adminPageDecision("creator"), "deny");
  assert.equal(adminPageDecision("guest"), "login");
  assert.equal(adminPageDecision("admin"), "allow");
  assert.equal(navigationFor("creator", false).some((item) => item.href.startsWith("/admin")), false);

  const route = fs.readFileSync(path.join(root, "app/auth/callback/route.ts"), "utf8");
  const staging = fs.readFileSync(path.join(root, "app/admin/staging/page.tsx"), "utf8");
  assert.match(route, /completeGoogleCallback/);
  assert.doesNotMatch(route, /storey_dev_role|readDevRole/);
  const proxy = fs.readFileSync(path.join(root, "proxy.ts"), "utf8");
  assert.match(proxy, /NODE_ENV === "development"/);
  assert.match(proxy, /storey_dev_role/);
  assert.match(staging, /requireAdminPage\("\/admin\/staging"\)/);
  assert.match(staging, /if \(!gate\.admin\) return <Denied/);
  assert.doesNotMatch(staging.slice(0, staging.indexOf("requireAdminPage")), /readWorkspace\(\)/);
});
