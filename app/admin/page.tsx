import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CsvUpload } from "@/components/csv-upload";
import { Denied, RoleNav } from "@/components/role-nav";
import { readAccess } from "@/lib/auth/access";
import { importPartySample, importPartyStock } from "@/lib/catalog/actions";

export const metadata: Metadata = {
  title: "ניהול קטלוג ומלאי",
  description: "ייבוא מוצרים ועדכון ספירת מלאי.",
};

async function AdminContent({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const [access, query] = await Promise.all([readAccess(), searchParams]);
  if (access.role === "guest") redirect("/login?next=/admin");
  if (access.role !== "admin") return <Denied access={access} />;
  const notice = query.notice === "stock" ? "הספירה התקינה הוחלה. זו ספירת פיתוח, לא אישור מחסן." : query.notice;

  return (
    <>
      <RoleNav access={access} />
      <h1 className="page-title">ניהול קטלוג ומלאי</h1>
      {notice ? <p className="status">{notice}</p> : null}
      <section className="card" aria-labelledby="import-title">
        <div className="copy">
          <h2 id="import-title" className="section-title">
            ייבוא מוצרים
          </h2>
          <p>מעלים CSV של ספק, רואים שורות תקינות ושגיאות, ומעבירים רק שורות תקינות לתור הבדיקה. האישור לקטלוג נעשה בתור.</p>
          <p>
            <a href="/samples/products.csv" download>
              הורדת CSV לדוגמה
            </a>
          </p>
          <form action={importPartySample}>
            <button className="button-publish" type="submit">
              ייבוא קונספט למסיבה לתור
            </button>
          </form>
          <CsvUpload kind="products" />
        </div>
      </section>
      <section className="card" aria-labelledby="stock-title">
        <div className="copy">
          <h2 id="stock-title" className="section-title">
            עדכון מלאי
          </h2>
          <p>מעלים ספירה מוחלטת לפי מק״ט ומחסן. ספירה ישנה, כפולה עם תוכן אחר, חור ברצף או כמות מתחת לשמירות פתוחות לא משנה את המלאי. חור ברצף או חוסר מול שמירה עוצר את המכירה.</p>
          <p className="hint">זו ספירת פיתוח. היא אינה אישור מחסן חי.</p>
          <p>
            <a href="/samples/stock.csv" download>
              הורדת CSV לדוגמה
            </a>
            {" · "}
            <a href="/samples/party-stock.csv" download>
              ספירת קונספט למסיבה
            </a>
          </p>
          <form action={importPartyStock}>
            <button className="button-publish" type="submit">
              החלת ספירת קונספט למסיבה
            </button>
          </form>
          <CsvUpload kind="stock" />
        </div>
      </section>
    </>
  );
}

export default function AdminPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  return (
    <main className="shell">
      <Suspense fallback={<p className="status">טוען…</p>}>
        <AdminContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
