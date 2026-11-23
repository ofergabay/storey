import Link from "next/link";

export function Wordmark({ href }: { href?: string }) {
  const mark = (
    <>
      storey<span className="storey-logo-dot">.</span>
    </>
  );
  if (!href) {
    return (
      <span className="wordmark" dir="ltr">
        {mark}
      </span>
    );
  }
  return (
    <Link href={href} className="wordmark" dir="ltr">
      {mark}
    </Link>
  );
}
