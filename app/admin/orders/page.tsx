import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Denied, RoleNav } from "@/components/role-nav";
import { readAccess } from "@/lib/auth/access";
import { readWorkspace } from "@/lib/workspace/store";

export const metadata: Metadata = { title: "הזמנות וחריגות", description: "הזמנות פיתוח והחזרות." };

async function AdminOrders() {
  const access = await readAccess();
  if (access.role === "guest") redirect("/login?next=/admin/orders");
  if (access.role !== "admin") return <Denied access={access} />;
  const workspace = readWorkspace();
  const exceptions = workspace.orders.filter((order) => order.status === "cancelled" || order.status === "held");
  return (
    <>
      <RoleNav access={access} />
      <h1 className="page-title">הזמנות וחריגות</h1>
      {workspace.orders.length === 0 ? <p className="status">אין הזמנות.</p> : null}
      <ul>
        {workspace.orders.map((order) => (
          <li key={order.id}>
            {order.sku} · {order.status === "dispatched" ? "נשלח" : order.status === "cancelled" ? "בוטל" : order.status === "held" ? "שמירה פתוחה" : "בטיפול"} · <Link href={`/track/${order.token}`}>מעקב</Link>
          </li>
        ))}
      </ul>
      <h2 className="section-title">חריגות</h2>
      {exceptions.length === 0 ? <p className="status">אין שמירות שפגו או הזמנות שבוטלו.</p> : null}
      <h2 className="section-title">החזרות</h2>
      {workspace.returns.length === 0 ? <p className="status">אין החזרות.</p> : null}
      <ul>
        {workspace.returns.map((item) => (
          <li key={item.id}>{item.status === "reconciled" ? "הותאמה" : item.status === "received" ? "התקבלה" : "התבקשה"} · {item.quantity}</li>
        ))}
      </ul>
    </>
  );
}

export default function AdminOrdersPage() {
  return (
    <main className="shell">
      <Suspense fallback={<p className="status">טוען…</p>}>
        <AdminOrders />
      </Suspense>
    </main>
  );
}
