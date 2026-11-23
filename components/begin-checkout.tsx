"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { beginCloudNineCheckout } from "@/lib/begin-checkout";

export function BeginCheckout({ quoteId }: { quoteId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <>
      <button
        className="button-publish"
        type="button"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            const result = await beginCloudNineCheckout(quoteId);
            if (!result.ok) {
              setMessage(result.message);
              return;
            }
            setMessage(null);
            router.refresh();
          });
        }}
      >
        {pending ? "שומר מלאי…" : "התחלת קופה"}
      </button>
      <p className="hint">הכפתור שומר את המארזים ל-10 דקות. אין תשלום.</p>
      {message ? (
        <p className="status" role="status">
          {message}
        </p>
      ) : null}
    </>
  );
}
