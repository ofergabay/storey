import assert from "node:assert/strict";
import test from "node:test";
import {
  authorizedDestination,
  failurePath,
  googleCancelledHe,
  readAuthContext,
  sanitizeNextPath,
  workspaceDestination,
} from "../lib/auth/oauth.ts";

test("return paths stay inside Storey and only the free plan is preserved", () => {
  assert.equal(sanitizeNextPath("/catalog"), "/catalog");
  assert.equal(sanitizeNextPath("/onboarding?plan=social"), "/onboarding?plan=social");
  assert.equal(sanitizeNextPath("/onboarding?plan=branded"), "/onboarding");
  assert.equal(sanitizeNextPath("https://evil.example/catalog"), null);
  assert.equal(sanitizeNextPath("//evil.example"), null);
  assert.equal(sanitizeNextPath("/admin/plans"), null);
});

test("a new free-plan creator reaches social onboarding and a returning user stays in their workspace", () => {
  const now = Date.parse("2026-11-23T12:00:00.000Z");
  assert.equal(
    workspaceDestination({ role: "creator", createdAt: "2026-11-23T11:59:30.000Z", now, requested: "/admin", intent: "register" }),
    "/onboarding?plan=social",
  );
  assert.equal(
    workspaceDestination({ role: "creator", createdAt: "2026-11-01T00:00:00.000Z", now, requested: "/catalog", intent: "login" }),
    "/catalog",
  );
  assert.equal(authorizedDestination("supplier", "/earnings"), "/supplier");
  assert.equal(authorizedDestination("admin", "/catalog"), "/admin/staging");
  assert.equal(authorizedDestination("creator", "/admin"), "/earnings");
});

test("a cancelled Google sign-in returns to the form that opened it", () => {
  const landing = readAuthContext(new URLSearchParams("intent=register&from=landing&channel=social"), () => undefined);
  assert.equal(failurePath(landing), "/?auth=register&error=google&channel=social#channel-selection");
  const page = readAuthContext(new URLSearchParams("error=access_denied"), (name) => {
    if (name === "storey_auth_intent") return "login";
    if (name === "storey_auth_from") return "page";
    return undefined;
  });
  assert.equal(page.intent, "login");
  assert.equal(failurePath(page), "/login?error=google");
  const remembered = readAuthContext(new URLSearchParams(), (name) => {
    if (name === "storey_auth_intent") return "register";
    if (name === "storey_auth_from") return "landing";
    if (name === "storey_auth_channel") return "social";
    if (name === "storey_auth_next") return encodeURIComponent("/onboarding?plan=social");
    return undefined;
  });
  assert.equal(remembered.next, "/onboarding?plan=social");
  assert.equal(failurePath(remembered), "/?auth=register&error=google&channel=social#channel-selection");
  assert.match(googleCancelledHe, /Google/);
  assert.match(googleCancelledHe, /אימייל/);
});
