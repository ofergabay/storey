import Link from "next/link";
import { Wordmark } from "@/components/wordmark";

export function LegalDocument({
  title,
  englishTitle,
  body,
  englishBody,
}: {
  title: string;
  englishTitle: string;
  body: string;
  englishBody: string;
}) {
  return (
    <main className="shell" lang="he" dir="rtl">
      <header className="topbar">
        <Wordmark href="/" />
        <Link className="button-secondary" href="/">
          חזרה
        </Link>
      </header>
      <article className="card">
        <div className="copy">
          <h1 className="page-title">{title}</h1>
          <p>{body}</p>
          <h2 className="section-title" dir="ltr">
            {englishTitle}
          </h2>
          <p dir="ltr">{englishBody}</p>
          <p className="hint">הקישור הזה שמור. הנוסח המשפטי יתפרסם כאן כשיהיה מאושר.</p>
        </div>
      </article>
    </main>
  );
}
