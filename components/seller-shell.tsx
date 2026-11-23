import Link from "next/link";
import { LISTING_PATH } from "@/lib/cloud-nine-public";
import { CLOUD_NINE_SELLER } from "@/lib/cloud-nine-seller";

export function SellerShell({
  current,
  admin = false,
  children,
}: {
  current: "pricing" | "preview";
  admin?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/" className="wordmark" dir="ltr">
          storey.
        </Link>
        <span className="tier">{CLOUD_NINE_SELLER.tierLabel}</span>
      </header>
      <nav className="nav" aria-label="ניווט בסטודיו">
        <Link href="/catalog">קטלוג</Link>
        <Link href="/studio" aria-current={current === "pricing" ? "page" : undefined}>
          תמחור
        </Link>
        <Link href={LISTING_PATH} aria-current={current === "preview" ? "page" : undefined}>
          תצוגת לקוח
        </Link>
        {admin ? <Link href="/admin">ניהול קטלוג ומלאי</Link> : null}
      </nav>
      {children}
    </div>
  );
}
