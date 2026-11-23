import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Denied, RoleNav } from "@/components/role-nav";
import { readAccess } from "@/lib/auth/access";
import { creatorAccess } from "@/lib/auth/permissions";
import { readSellerPlan } from "@/lib/seller-plan";
import { sellerHandleFromEmail } from "@/lib/catalog/identity";
import { formatShekels } from "@/lib/money";
import { readWorkspace } from "@/lib/workspace/store";

export const metadata: Metadata = { title: "הזמנות", description: "הזמנות של המודעות שפורסמו." };

async function OrdersContent() {
  const access = await readAccess();
  if (access.role === "guest") redirect("/login?next=/orders");
  if (access.role !== "creator" && access.role !== "admin") return <Denied access={access} />;
  const handle = sellerHandleFromEmail(access.email ?? "", access.userId ?? "");
  const orders = readWorkspace().orders.filter((order) => access.role === "admin" || order.sellerHandle === handle);
  return (
    <>
      <RoleNav access={access} />
      <h1 className="page-title">הזמנות והחזרות</h1>
      <PrivacyNote role={access.role} />
      {orders.length === 0 ? <p className="status">אין הזמנות עדיין.</p> : null}
      <div className="catalog-list">
        {orders.map((order) => (
          <article className="card" key={order.id}>
            <div className="copy">
              <p>
                {order.status === "held"
                  ? "שמירה פתוחה"
                  : order.status === "sandbox_paid"
                    ? "שולם בסביבת בדיקה"
                    : order.status === "picking"
                      ? "בליקוט"
                      : order.status === "packed"
                        ? "נארז"
                        : order.status === "labeled"
                          ? "עם מדבקה"
                          : order.status === "dispatched"
                            ? "נשלח"
                            : "בוטל"}
              </p>
              <p dir="ltr">{formatShekels(order.unitAgorot * order.quantity)}</p>
              <Link href={`/track/${order.token}`}>מעקב</Link>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

async function PrivacyNote({ role }: { role: "creator" | "admin" }) {
  if (role === "admin") return null;
  const plan = await readSellerPlan();
  if (creatorAccess(plan.code, "creator.orders") !== "MASKED_PII") return null;
  return <p className="hint">פרטי הקשר של הלקוח מוסתרים במסלול {plan.nameHe}.</p>;
}

export default function OrdersPage() {
  return (
    <main className="shell">
      <Suspense fallback={<p className="status">טוען…</p>}>
        <OrdersContent />
      </Suspense>
    </main>
  );
}
