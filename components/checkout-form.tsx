"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PlacePicker, type PlaceOption } from "@/components/place-picker";
import {
  CHECKOUT_PATH,
  MAX_QUOTE_QUANTITY,
  cleanQuoteText,
  normalizeQuotePhone,
  parseHouseNumber,
  parseQuoteQuantity,
  quoteFieldError,
  type CheckoutDraft,
} from "@/lib/checkout-quote";
import { saveCheckoutQuote } from "@/lib/save-checkout-quote";
import { formatShekels } from "@/lib/money";

type StreetState = {
  status: "idle" | "loading" | "ready" | "error";
  streets: string[];
};

export function CheckoutForm({
  title,
  packLabel,
  unitAgorot,
  cities,
}: {
  title: string;
  packLabel: string;
  unitAgorot: number;
  cities: { code: number; name: string }[];
}) {
  const router = useRouter();
  const streetRequest = useRef(0);
  const [draft, setDraft] = useState<CheckoutDraft>({
    quantity: "1",
    recipientName: "",
    phone: "",
    city: "",
    cityCode: "",
    street: "",
    houseNumber: "",
    accepted: false,
  });
  const [streetState, setStreetState] = useState<StreetState>({ status: "idle", streets: [] });
  const [attempted, setAttempted] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const quantity = parseQuoteQuantity(draft.quantity);
  const merchandise = quantity === null ? null : unitAgorot * quantity;
  const cityOptions = cities.map((city) => ({ id: String(city.code), label: city.name }));
  const streetOptions = streetState.streets.map((street) => ({ id: street, label: street }));
  const quantities = Array.from({ length: MAX_QUOTE_QUANTITY }, (_, index) => String(index + 1));

  function update(patch: Partial<CheckoutDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
    setMessage(null);
  }

  async function loadStreets(cityCode: string) {
    const request = ++streetRequest.current;
    setStreetState({ status: "loading", streets: [] });
    try {
      const response = await fetch(`/api/israel/streets?city=${encodeURIComponent(cityCode)}`);
      const body = (await response.json()) as { streets?: unknown };
      if (streetRequest.current !== request) return;
      if (!response.ok || !Array.isArray(body.streets) || body.streets.some((street) => typeof street !== "string")) {
        setStreetState({ status: "error", streets: [] });
        return;
      }
      setStreetState({ status: "ready", streets: body.streets });
    } catch {
      if (streetRequest.current !== request) return;
      setStreetState({ status: "error", streets: [] });
    }
  }

  function chooseCity(option: PlaceOption | null) {
    if (!option) {
      if (!draft.cityCode) return;
      streetRequest.current += 1;
      setStreetState({ status: "idle", streets: [] });
      update({ city: "", cityCode: "", street: "" });
      return;
    }
    if (option.id === draft.cityCode) return;
    update({ city: option.label, cityCode: option.id, street: "" });
    void loadStreets(option.id);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitted = draft;
    setAttempted(true);
    const problem = quoteFieldError(submitted);
    if (problem) {
      setMessage(problem);
      return;
    }
    if (streetState.status === "loading") {
      setMessage("הרחובות עדיין נטענים.");
      return;
    }
    if (streetState.status === "ready" && streetState.streets.length === 0) {
      setMessage("אין רחובות רשמיים ליישוב הזה ברשימה.");
      return;
    }
    setPending(true);
    try {
      const result = await saveCheckoutQuote(submitted);
      if (!result.ok) {
        setMessage(result.message);
        setPending(false);
        return;
      }
      router.push(`${CHECKOUT_PATH}/${result.quote.id}`);
    } catch {
      setMessage("ההצעה לא נשמרה. הפרטים נשארו בטופס ואפשר לנסות שוב.");
      setPending(false);
    }
  }

  const nameError = attempted && cleanQuoteText(draft.recipientName, 2, 80) === null ? "הזינו שם." : null;
  const phoneError = attempted && normalizeQuotePhone(draft.phone) === null ? "הזינו מספר טלפון ישראלי." : null;
  const cityError = attempted && draft.cityCode === "" ? "בחרו עיר מהרשימה." : null;
  const streetError =
    attempted &&
    draft.cityCode !== "" &&
    streetState.status === "ready" &&
    streetState.streets.length > 0 &&
    draft.street === ""
      ? "בחרו רחוב מהרשימה."
      : null;
  const numberError = attempted && parseHouseNumber(draft.houseNumber) === null ? "הזינו מספר בית." : null;
  const streetPlaceholder = !draft.cityCode
    ? "בחרו עיר קודם"
    : streetState.status === "loading"
      ? "טוען רחובות…"
      : "הקלידו שם רחוב";

  return (
    <form className="auth-form" onSubmit={(event) => void onSubmit(event)}>
      <div className="quote-lines">
        <p className="quote-line">
          <span>מחיר למארז</span>
          <strong dir="ltr">{formatShekels(unitAgorot)}</strong>
        </p>
        <p className="quote-line">
          <span>סה״כ למארזים</span>
          <strong dir="ltr">{merchandise === null ? "—" : formatShekels(merchandise)}</strong>
        </p>
        <p className="quote-line">
          <span>מע״מ</span>
          <strong>לא חושב</strong>
        </p>
        <p className="quote-line">
          <span>משלוח</span>
          <strong>לא חושב</strong>
        </p>
      </div>
      <label htmlFor="quote-quantity">
        כמות מארזים
        <select
          id="quote-quantity"
          value={draft.quantity}
          onChange={(event) => update({ quantity: event.target.value })}
        >
          {quantities.map((amount) => (
            <option key={amount} value={amount}>
              {amount}
            </option>
          ))}
        </select>
      </label>
      <label htmlFor="quote-name">
        שם
        <input
          id="quote-name"
          autoComplete="name"
          value={draft.recipientName}
          onChange={(event) => update({ recipientName: event.target.value })}
        />
        {nameError ? <span className="field-error">{nameError}</span> : null}
      </label>
      <label htmlFor="quote-phone">
        טלפון
        <input
          id="quote-phone"
          dir="ltr"
          inputMode="tel"
          autoComplete="tel"
          placeholder="0501234567"
          aria-invalid={phoneError ? true : undefined}
          value={draft.phone}
          onChange={(event) => update({ phone: event.target.value.replace(/[^\d+\s()-]/g, "").slice(0, 20) })}
        />
        {phoneError ? <span className="field-error">{phoneError}</span> : <span className="field-note">נייד או נייח בישראל</span>}
      </label>
      <PlacePicker
        id="quote-city"
        label="עיר"
        ariaLabel="עיר"
        options={cityOptions}
        selectedId={draft.cityCode}
        onSelect={chooseCity}
        placeholder="הקלידו שם יישוב"
        invalid={cityError !== null}
      />
      {cityError ? <p className="field-error">{cityError}</p> : null}
      <div className="place-field">
        <span>רחוב ומספר</span>
        <div className="address-pair">
          <PlacePicker
            key={draft.cityCode || "street"}
            id="quote-street"
            ariaLabel="רחוב"
            options={streetOptions}
            selectedId={draft.street}
            onSelect={(option) => update({ street: option?.label ?? "" })}
            disabled={!draft.cityCode || streetState.status !== "ready" || streetOptions.length === 0}
            placeholder={streetPlaceholder}
            invalid={streetError !== null}
          />
          <label htmlFor="quote-number">
            <input
              id="quote-number"
              dir="ltr"
              inputMode="numeric"
              autoComplete="off"
              placeholder="מספר"
              aria-label="מספר בית"
              aria-invalid={numberError ? true : undefined}
              value={draft.houseNumber}
              onChange={(event) => update({ houseNumber: event.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 5) })}
            />
          </label>
        </div>
        {streetState.status === "loading" ? <p className="field-note">טוען רחובות…</p> : null}
        {streetState.status === "error" ? (
          <button type="button" className="text-button" onClick={() => void loadStreets(draft.cityCode)}>
            טעינת הרחובות נכשלה. נסו שוב
          </button>
        ) : null}
        {streetState.status === "ready" && streetState.streets.length === 0 ? (
          <p className="field-error">אין רחובות רשמיים ליישוב הזה ברשימה.</p>
        ) : null}
        {streetError ? <p className="field-error">{streetError}</p> : null}
        {numberError ? <p className="field-error">{numberError}</p> : null}
      </div>
      <label className="check-row" htmlFor="quote-accept">
        <input
          id="quote-accept"
          type="checkbox"
          checked={draft.accepted}
          onChange={(event) => update({ accepted: event.target.checked })}
        />
        <span>
          ההצעה ל-{title} היא {packLabel} בלבד. מע״מ ומשלוח לא מחושבים, ואין תשלום.
        </span>
      </label>
      <button className="button-publish" type="submit" disabled={pending}>
        {pending ? "שומר…" : "שמירת הצעת המחיר"}
      </button>
      {message ? (
        <p className="status" role="status">
          {message}
        </p>
      ) : (
        <p className="hint">שמירת ההצעה לא שומרת מלאי ולא גובה תשלום. שמירת המארזים מתחילה רק בלחיצה על התחלת קופה.</p>
      )}
    </form>
  );
}
