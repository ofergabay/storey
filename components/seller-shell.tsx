import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { LISTING_PATH } from "@/lib/cloud-nine-public";
import { CLOUD_NINE_SELLER } from "@/lib/cloud-nine-seller";
import { pickCopy } from "@/lib/i18n/locale";
import { readLocale } from "@/lib/i18n/server";

export async function SellerShell({
  current,
  admin = false,
  children,
}: {
  current: "pricing" | "preview";
  admin?: boolean;
  children: React.ReactNode;
}) {
  const locale = await readLocale();
  const label = (he: string, en: string) => pickCopy(locale, he, en);
  return (
    <div className="shell">
      <header className="topbar">
        <Wordmark href="/" />
        <span className="tier">{CLOUD_NINE_SELLER.tierLabel}</span>
      </header>
      <nav className="nav" aria-label={label("ניווט בסטודיו", "Studio navigation")}>
        <Link href="/catalog">{label("קטלוג", "Catalog")}</Link>
        <Link href="/studio" aria-current={current === "pricing" ? "page" : undefined}>
          {label("תמחור", "Pricing")}
        </Link>
        <Link href={LISTING_PATH} aria-current={current === "preview" ? "page" : undefined}>
          {label("תצוגת לקוח", "Customer preview")}
        </Link>
        {admin ? <Link href="/admin">{label("ניהול קטלוג ומלאי", "Catalog and stock")}</Link> : null}
      </nav>
      {children}
    </div>
  );
}
