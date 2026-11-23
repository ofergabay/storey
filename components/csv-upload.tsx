"use client";

import { useState } from "react";
import { approveProductUpload, applyStockUpload, previewProductUpload, previewStockUpload } from "@/lib/catalog/actions";
import type { ProductPreview, StockPreview } from "@/lib/catalog/model";

export function CsvUpload({ kind }: { kind: "products" | "stock" }) {
  const [fileText, setFileText] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [products, setProducts] = useState<ProductPreview[] | null>(null);
  const [stock, setStock] = useState<StockPreview[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const productsMode = kind === "products";

  async function readFile(file: File | null) {
    setProducts(null);
    setStock(null);
    setNotes([]);
    setMessage(null);
    if (!file) {
      setFileText(null);
      return;
    }
    setFileText(await file.text());
  }

  async function preview() {
    if (!fileText) {
      setMessage("בחרו קובץ CSV.");
      return;
    }
    setPending(true);
    const result = productsMode ? await previewProductUpload(fileText) : await previewStockUpload(fileText);
    setPending(false);
    if (!result.ok) {
      setMessage(result.message);
      setProducts(null);
      setStock(null);
      return;
    }
    setNotes(result.notes);
    setMessage(null);
    if (productsMode) setProducts(result.rows as ProductPreview[]);
    else setStock(result.rows as StockPreview[]);
  }

  async function apply() {
    if (!fileText) return;
    setPending(true);
    if (productsMode) {
      const result = await approveProductUpload(fileText);
      setPending(false);
      setMessage(result.ok ? `הועברו ${result.approved} שורות לתור הבדיקה.` : result.message);
      return;
    }
    const result = await applyStockUpload(fileText);
    setPending(false);
    setMessage(result.ok ? `עודכנו ${result.applied} ספירות.` : result.message);
  }

  return (
    <div className="copy csv-upload">
      <label htmlFor={kind}>
        קובץ CSV
        <input
          id={kind}
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => void readFile(event.target.files?.[0] ?? null)}
        />
      </label>
      <button className="button-secondary" type="button" disabled={pending} onClick={() => void preview()}>
        תצוגה מקדימה
      </button>
      <button className="button-publish" type="button" disabled={pending || !fileText} onClick={() => void apply()}>
        {productsMode ? "העברה לתור בדיקה" : "החלת עדכונים תקינים"}
      </button>
      {notes.map((note) => (
        <p key={note} className="status">
          {note}
        </p>
      ))}
      {products ? (
        <div className="preview-list">
          {products.map((row) => (
            <article key={`${row.line}-${row.sku}`}>
              <p>
                שורה {row.line} · <span dir="ltr">{row.sku || "—"}</span>
              </p>
              <p>{row.message}</p>
            </article>
          ))}
        </div>
      ) : null}
      {stock ? (
        <div className="preview-list">
          {stock.map((row) => (
            <article key={`${row.line}-${row.sku}`}>
              <p>
                שורה {row.line} · <span dir="ltr">{row.sku || "—"}</span>
              </p>
              <p>{row.message}</p>
              <p dir="ltr">
                {row.previous ?? "—"} → {row.next ?? "—"}
              </p>
            </article>
          ))}
        </div>
      ) : null}
      {message ? (
        <p className="status" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
