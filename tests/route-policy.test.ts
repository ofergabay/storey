import assert from "node:assert/strict";
import test from "node:test";
import { allowsOperational, navigationFor } from "../lib/auth/permissions.ts";
import { routeRedirect } from "../lib/auth/route-policy.ts";
import { maskPhone, maskStreet } from "../lib/privacy.ts";

test("admin does not inherit creator or supplier routes", () => {
  assert.equal(routeRedirect({ pathname: "/catalog", role: "admin", inspect: false, development: false }), "/admin/staging");
  assert.equal(routeRedirect({ pathname: "/catalog/PARTY-01", role: "admin", inspect: false, development: false }), null);
  assert.equal(routeRedirect({ pathname: "/studio", role: "admin", inspect: false, development: false }), null);
  assert.equal(routeRedirect({ pathname: "/catalog", role: "admin", inspect: false, development: false, unavailable: true }), null);
  assert.equal(routeRedirect({ pathname: "/catalog/start", role: "admin", inspect: false, development: false }), null);
  assert.equal(routeRedirect({ pathname: "/catalog/start", role: "guest", inspect: false, development: false }), null);
  assert.equal(routeRedirect({ pathname: "/supplier", role: "admin", inspect: false, development: false }), "/admin/staging");
  assert.equal(routeRedirect({ pathname: "/supplier/stock", role: "admin", inspect: true, development: false }), null);
  assert.equal(allowsOperational("admin", "creator", false), false);
  assert.equal(allowsOperational("admin", "supplier", true), true);
  assert.equal(allowsOperational("creator", "supplier", true), false);
});

test("a signed-in person leaves login, register, plans, and the public landing", () => {
  assert.equal(routeRedirect({ pathname: "/login", role: "creator", inspect: false, development: false }), "/earnings");
  assert.equal(routeRedirect({ pathname: "/register", role: "supplier", inspect: false, development: false }), "/supplier");
  assert.equal(routeRedirect({ pathname: "/plans", role: "creator", inspect: false, development: false }), "/earnings");
  assert.equal(routeRedirect({ pathname: "/plans", role: "guest", inspect: false, development: false }), null);
  assert.equal(routeRedirect({ pathname: "/", role: "creator", inspect: false, development: false }), "/earnings");
  assert.equal(routeRedirect({ pathname: "/", role: "supplier", inspect: false, development: false }), "/supplier");
  assert.equal(routeRedirect({ pathname: "/", role: "admin", inspect: false, development: false }), "/admin/staging");
  assert.equal(routeRedirect({ pathname: "/", role: "admin", inspect: false, development: false, preview: true }), null);
  assert.equal(routeRedirect({ pathname: "/", role: "admin", inspect: false, development: false, product: "party-01" }), "/catalog/start?product=party-01");
  assert.equal(routeRedirect({ pathname: "/", role: "creator", inspect: false, development: false, product: "party-01" }), "/catalog/start?product=party-01");
  assert.equal(routeRedirect({ pathname: "/", role: "guest", inspect: false, development: false, product: "party-01" }), null);
  assert.equal(routeRedirect({ pathname: "/", role: "supplier", inspect: false, development: false, product: "party-01" }), "/supplier");
  assert.equal(routeRedirect({ pathname: "/", role: "guest", inspect: false, development: false }), null);
  assert.equal(routeRedirect({ pathname: "/register/supplier", role: "creator", inspect: false, development: false }), null);
  assert.equal(routeRedirect({ pathname: "/earnings", role: "guest", inspect: false, development: false }), "/login?next=%2Fearnings");
  assert.equal(routeRedirect({ pathname: "/admin/staging", role: "creator", inspect: false, development: false }), "/earnings");
  assert.equal(routeRedirect({ pathname: "/admin/staging", role: "admin", inspect: false, development: false }), null);
});

test("admin navigation includes catalog, finance, and audit", () => {
  const admin = navigationFor("admin", false).map((item) => item.href);
  for (const href of ["/admin", "/admin/staging", "/admin/approvals", "/admin/plans", "/admin/orders", "/admin/catalog", "/admin/finance", "/admin/audit"]) {
    assert.equal(admin.includes(href), true, href);
  }
  const creator = navigationFor("creator", false).map((item) => item.href);
  const supplier = navigationFor("supplier", false).map((item) => item.href);
  assert.equal(creator.some((href) => href.startsWith("/admin")), false);
  assert.equal(supplier.some((href) => href.startsWith("/admin")), false);
  assert.equal(admin.some((href) => href.startsWith("/supplier") || href === "/earnings"), false);
});

test("buyer phone and street are masked", () => {
  assert.equal(maskPhone("0501234567"), "•••67");
  assert.equal(maskStreet(), "רחוב מוסתר");
});
