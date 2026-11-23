export type JournalLine = {
  account: string;
  debit: number;
  credit: number;
};

export type CaptureInput = {
  key: string;
  gross: number;
  lines: JournalLine[];
};

export type Order = {
  id: string;
  key: string;
  fingerprint: string;
  gross: number;
  lines: JournalLine[];
  refunds: { key: string; amount: number; lines: JournalLine[] }[];
};

export type Ledger = {
  orders: Order[];
};

export function emptyLedger(): Ledger {
  return { orders: [] };
}

export function capture(
  ledger: Ledger,
  input: CaptureInput,
): { ok: true; ledger: Ledger; order: Order; replayed: boolean } | { ok: false; code: "CONFLICT" | "UNBALANCED"; ledger: Ledger } {
  const fingerprint = stableFingerprint(input);
  const existing = ledger.orders.find((order) => order.key === input.key);
  if (existing) {
    if (existing.fingerprint !== fingerprint) return { ok: false, code: "CONFLICT", ledger };
    return { ok: true, ledger, order: existing, replayed: true };
  }
  if (!balanced(input.lines, input.gross)) return { ok: false, code: "UNBALANCED", ledger };
  const order: Order = {
    id: `order-${ledger.orders.length + 1}`,
    key: input.key,
    fingerprint,
    gross: input.gross,
    lines: input.lines,
    refunds: [],
  };
  return { ok: true, ledger: { orders: [...ledger.orders, order] }, order, replayed: false };
}

export function refundOrder(
  ledger: Ledger,
  input: { orderId: string; key: string; amount: number; lines: JournalLine[] },
): { ok: true; ledger: Ledger; replayed: boolean } | { ok: false; code: "MISSING" | "CONFLICT" | "UNBALANCED" | "EXCEEDS"; ledger: Ledger } {
  const order = ledger.orders.find((row) => row.id === input.orderId);
  if (!order) return { ok: false, code: "MISSING", ledger };
  const existing = order.refunds.find((row) => row.key === input.key);
  if (existing) {
    const same = existing.amount === input.amount && stableFingerprint({ key: input.key, gross: input.amount, lines: input.lines }) === stableFingerprint({ key: input.key, gross: existing.amount, lines: existing.lines });
    if (!same) return { ok: false, code: "CONFLICT", ledger };
    return { ok: true, ledger, replayed: true };
  }
  if (!balanced(input.lines, input.amount)) return { ok: false, code: "UNBALANCED", ledger };
  const already = order.refunds.reduce((sum, row) => sum + row.amount, 0);
  if (input.amount < 1 || already + input.amount > order.gross) return { ok: false, code: "EXCEEDS", ledger };
  const orders = ledger.orders.map((row) =>
    row.id === order.id ? { ...row, refunds: [...row.refunds, { key: input.key, amount: input.amount, lines: input.lines }] } : row,
  );
  return { ok: true, ledger: { orders }, replayed: false };
}

export function zeroTaxCapture(key: string): CaptureInput {
  return {
    key,
    gross: 110,
    lines: [
      { account: "psp-clearing", debit: 110, credit: 0 },
      { account: "supplier-payable", debit: 0, credit: 70 },
      { account: "seller-payable", debit: 0, credit: 35 },
      { account: "platform-revenue", debit: 0, credit: 5 },
    ],
  };
}

export function accountNet(lines: JournalLine[], account: string): number {
  return lines.filter((line) => line.account === account).reduce((sum, line) => sum + line.credit - line.debit, 0);
}

function balanced(lines: JournalLine[], gross: number): boolean {
  const debit = lines.reduce((sum, line) => sum + line.debit, 0);
  const credit = lines.reduce((sum, line) => sum + line.credit, 0);
  return debit === credit && debit === gross && lines.every((line) => line.debit >= 0 && line.credit >= 0);
}

function stableFingerprint(input: CaptureInput): string {
  const lines = [...input.lines].sort((left, right) => left.account.localeCompare(right.account));
  return JSON.stringify({ gross: input.gross, lines });
}
