import { WorkspaceTitle } from "@/components/workspace-title";
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { RoleNav } from "@/components/role-nav";
import { readAccess } from "@/lib/auth/access";
import { readCatalog } from "@/lib/catalog/store";
import { formatShekels } from "@/lib/money";
import { readWorkspace } from "@/lib/workspace/store";

export const metadata: Metadata = { title: "עגלה", description: "העגלה לא שומרת מלאי." };

async function CartContent() {
  const access = await readAccess();
  const ownerId = access.userId ?? "guest";
  const line = readWorkspace().carts.find((cart) => cart.ownerId === ownerId)?.line;
  const listing = line
    ? readCatalog().listings.find((item) => item.sellerHandle === line.sellerHandle && item.slug === line.slug && item.retailAgorot > 0)
    : undefined;
  return (
    <>
      <RoleNav access={access} />
      <WorkspaceTitle he="עגלה" en="Cart" />
      <p className="hint">העגלה, השיתוף ושמירת הטיוטה לא שומרים מלאי.</p>
      {listing && line ? (
        <article className="card">
          <div className="copy">
            <p>
              {line.quantity} מארזים · <strong dir="ltr">{formatShekels(listing.retailAgorot)}</strong>
            </p>
            <Link className="button-publish" href={`/s/${line.sellerHandle}/${line.slug}/checkout`}>
              להצעת מחיר
            </Link>
          </div>
        </article>
      ) : (
        <p className="status">העגלה ריקה.</p>
      )}
    </>
  );
}

export default function CartPage() {
  return (
    <main className="shell">
      <Suspense fallback={<p className="status">טוען…</p>}>
        <CartContent />
      </Suspense>
    </main>
  );
}
