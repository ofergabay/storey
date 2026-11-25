"use client";

import { useState } from "react";
import { deleteLandingFaq, moveLandingFaq, saveLandingFaq } from "@/lib/landing/faq-actions";
import type { FaqItem } from "@/lib/landing/faq";

function FaqFields({ item, onDone }: { item?: FaqItem; onDone: (message: string) => void }) {
  return (
    <form
      className="faq-editor"
      action={async (formData) => {
        const result = await saveLandingFaq(formData);
        onDone(result.ok ? "" : result.message);
      }}
    >
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      <label>
        שאלה בעברית
        <input name="heQ" defaultValue={item?.heQ ?? ""} required />
      </label>
      <label>
        תשובה בעברית
        <textarea name="heA" defaultValue={item?.heA ?? ""} required />
      </label>
      <label>
        Question in English
        <input name="enQ" defaultValue={item?.enQ ?? ""} required />
      </label>
      <label>
        Answer in English
        <textarea name="enA" defaultValue={item?.enA ?? ""} required />
      </label>
      <div className="faq-editor-actions">
        <button className="storey-cta" type="submit">שמירה</button>
        <button className="storey-quiet" type="button" onClick={() => onDone("")}>ביטול</button>
      </div>
    </form>
  );
}

export function FaqAdmin({ faqs }: { faqs: FaqItem[] }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  return (
    <section className="storey-faq">
      {notice ? <p className="status">{notice}</p> : null}
      <div className="faq-admin">
        <button className="storey-quiet" type="button" onClick={() => setAdding((open) => !open)}>
          + הוספת שאלה חדשה
        </button>
        {adding ? <FaqFields onDone={(message) => { setNotice(message); if (!message) setAdding(false); }} /> : null}
      </div>
      <div className="faq-list">
        {faqs.map((item) => (
          <article key={item.id}>
            <h2 className="section-title">{item.heQ}</h2>
            <p>{item.heA}</p>
            <div className="faq-admin-row">
              <button className="storey-quiet" type="button" onClick={() => setEditing(editing === item.id ? null : item.id)}>
                עריכה
              </button>
              <form action={async (formData) => setNotice((await deleteLandingFaq(formData)).ok ? "" : "שמירת השאלות נכשלה.")}>
                <input type="hidden" name="id" value={item.id} />
                <button className="storey-quiet" type="submit">מחיקה</button>
              </form>
              <form action={async (formData) => {
                const result = await moveLandingFaq(formData);
                if (!result.ok) setNotice(result.message);
              }}>
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="direction" value="-1" />
                <button className="storey-quiet" type="submit">למעלה</button>
              </form>
              <form action={async (formData) => {
                const result = await moveLandingFaq(formData);
                if (!result.ok) setNotice(result.message);
              }}>
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="direction" value="1" />
                <button className="storey-quiet" type="submit">למטה</button>
              </form>
            </div>
            {editing === item.id ? (
              <FaqFields item={item} onDone={(message) => { setNotice(message); if (!message) setEditing(null); }} />
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
