import { ProductArt } from "@/components/product-art";
import { Wordmark } from "@/components/wordmark";

export function PublicListing({
  title,
  summary,
  packLabel,
  packSize,
  packUnit,
  sellerHandle,
  sellerInitials,
  sellerName,
  sellingPrice,
  checkoutHref,
  checkoutNote = "ההצעה מחשבת את סך המארזים. מע״מ ומשלוח לא מחושבים, ואין תשלום.",
}: {
  title: string;
  summary: string;
  packLabel: string;
  packSize: number;
  packUnit: string;
  sellerHandle: string;
  sellerInitials: string;
  sellerName: string;
  sellingPrice: string | null;
  checkoutHref?: string;
  checkoutNote?: string;
}) {
  const pack = `${packLabel} · ${packSize} ${packUnit}`;

  return (
    <article className="customer-card">
      <header className="topbar customer-topbar">
        <Wordmark />
      </header>
      <ProductArt sticker={pack} />
      <div className="copy">
        <p className="meta">
          <span dir="ltr">{sellerHandle}</span>
        </p>
        <h1 className="product-title" dir="ltr">
          {title}
        </h1>
        <p className="summary">{summary}</p>
        <p className="pack">{pack}</p>
        {sellingPrice ? (
          <>
            <p className="selling-price">
              <span>מחיר למארז</span>
              <strong dir="ltr">{sellingPrice}</strong>
            </p>
            <p className="checkout-note">{checkoutNote}</p>
            {checkoutHref ? (
              <a className="button-publish" href={checkoutHref}>
                להצעת מחיר
              </a>
            ) : null}
          </>
        ) : (
          <p className="inactive">הקישור אינו פעיל</p>
        )}
        <p className="seller-line">
          <span className="avatar" aria-hidden="true">
            {sellerInitials}
          </span>
          {sellerName}
        </p>
      </div>
    </article>
  );
}
