export const CHECKOUT_PATH = "/s/maya/cloud-nine/checkout";
export const MAX_QUOTE_QUANTITY = 20;
const MAX_STREET_NAME = 60;

export type CheckoutDraft = {
  quantity: string;
  recipientName: string;
  phone: string;
  city: string;
  cityCode: string;
  street: string;
  houseNumber: string;
  accepted: boolean;
};

export type QuoteDetails = {
  quantity: number;
  recipientName: string;
  phone: string;
  city: string;
  cityCode: number;
  streetName: string;
  houseNumber: string;
  street: string;
};

export type SavedQuote = {
  id: string;
  quantity: number;
  unitRetailAgorot: number;
  merchandiseAgorot: number;
  recipientName: string;
  phone: string;
  city: string;
  street: string;
  holdExpiresAt: string | null;
};

export function parseQuoteQuantity(value: string): number | null {
  const trimmed = value.trim();
  if (!/^(?:[1-9]|1\d|20)$/.test(trimmed)) return null;
  return Number(trimmed);
}

export function cleanQuoteText(value: string, min: number, max: number): string | null {
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (cleaned.length < min || cleaned.length > max) return null;
  if (/[\u0000-\u001f]/.test(cleaned)) return null;
  return cleaned;
}

export function parseCityCode(value: string): number | null {
  if (!/^[1-9]\d{0,5}$/.test(value)) return null;
  return Number(value);
}

export function parseHouseNumber(value: string): string | null {
  return /^[1-9]\d{0,4}$/.test(value) ? value : null;
}

// Israeli national numbers: 05/07 are 10 digits, 02/03/04/08/09 are 9 digits.
// +972 and 00972 are stored as the local 0-prefixed form.
export function normalizeQuotePhone(value: string): string | null {
  let compact = value.replace(/[^\d+]/g, "");
  if (compact.startsWith("+")) compact = compact.slice(1);
  if (compact.startsWith("00972")) compact = compact.slice(5);
  else if (compact.startsWith("972")) compact = compact.slice(3);
  if (!compact.startsWith("0")) compact = `0${compact}`;
  if (!/^0(?:5\d{8}|[23489]\d{7}|7\d{8})$/.test(compact)) return null;
  return compact;
}

export function quoteFieldError(draft: CheckoutDraft): string | null {
  if (parseQuoteQuantity(draft.quantity) === null) return "בחרו כמות מארזים.";
  if (cleanQuoteText(draft.recipientName, 2, 80) === null) return "הזינו שם.";
  if (normalizeQuotePhone(draft.phone) === null) return "הזינו מספר טלפון ישראלי.";
  if (parseCityCode(draft.cityCode) === null || cleanQuoteText(draft.city, 2, 40) === null) {
    return "בחרו עיר מהרשימה.";
  }
  if (cleanQuoteText(draft.street, 2, MAX_STREET_NAME) === null) return "בחרו רחוב מהרשימה.";
  if (parseHouseNumber(draft.houseNumber) === null) return "הזינו מספר בית.";
  if (!draft.accepted) return "סמנו שההצעה היא למארזים בלבד, בלי מע״מ, בלי משלוח ובלי תשלום.";
  return null;
}

export function quoteDetails(draft: CheckoutDraft): QuoteDetails | null {
  if (quoteFieldError(draft)) return null;
  const quantity = parseQuoteQuantity(draft.quantity);
  const recipientName = cleanQuoteText(draft.recipientName, 2, 80);
  const phone = normalizeQuotePhone(draft.phone);
  const city = cleanQuoteText(draft.city, 2, 40);
  const cityCode = parseCityCode(draft.cityCode);
  const streetName = cleanQuoteText(draft.street, 2, MAX_STREET_NAME);
  const houseNumber = parseHouseNumber(draft.houseNumber);
  if (
    quantity === null ||
    recipientName === null ||
    phone === null ||
    city === null ||
    cityCode === null ||
    streetName === null ||
    houseNumber === null
  ) {
    return null;
  }
  const street = `${streetName} ${houseNumber}`;
  if (street.length > 80) return null;
  return { quantity, recipientName, phone, city, cityCode, streetName, houseNumber, street };
}

export function parseSavedQuote(value: unknown): SavedQuote | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = row.id;
  const quantity = row.quantity;
  const unitRetailAgorot = row.unit_retail_agorot;
  const merchandiseAgorot = row.merchandise_agorot;
  const recipientName = row.recipient_name;
  const phone = row.phone;
  const city = row.city;
  const street = row.street;
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  if (typeof quantity !== "number" || typeof unitRetailAgorot !== "number" || typeof merchandiseAgorot !== "number") {
    return null;
  }
  if (quantity < 1 || quantity > MAX_QUOTE_QUANTITY) return null;
  if (unitRetailAgorot <= 0 || merchandiseAgorot !== unitRetailAgorot * quantity) return null;
  if (
    typeof recipientName !== "string" ||
    typeof phone !== "string" ||
    typeof city !== "string" ||
    typeof street !== "string"
  ) {
    return null;
  }
  const privateKeys = ["net_wholesale", "draft_retail", "owner_id", "earnings"];
  if (privateKeys.some((key) => key in row)) return null;
  let holdExpiresAt: string | null = null;
  if (row.hold_expires_at != null || row.hold_quantity != null) {
    if (typeof row.hold_expires_at !== "string" || row.hold_quantity !== quantity) return null;
    holdExpiresAt = row.hold_expires_at;
  }
  return {
    id,
    quantity,
    unitRetailAgorot,
    merchandiseAgorot,
    recipientName,
    phone,
    city,
    street,
    holdExpiresAt,
  };
}
