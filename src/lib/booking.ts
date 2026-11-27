// Pure booking helpers shared by the customer pages (no React, no network) so they can be unit-tested.

export type Addon = { id: string; name: string; price: number };
export type Category = "coffee" | "matcha";
export type CartLine = {
  key: string;
  itemId: string;
  name: string;
  category: Category;
  price: number;
  addons: Addon[];
  qty: number;
  /** Per-drink note ("less ice"); applies to every drink on this line. */
  note?: string;
};

export const MAX_LINE_QTY = 10;
export const MAX_NOTE = 120;

export function lineKey(itemId: string, addonIds: string[]): string {
  return `${itemId}|${[...addonIds].sort().join(",")}`;
}

export function unitPrice(line: Pick<CartLine, "price" | "addons">): number {
  return line.price + line.addons.reduce((s, a) => s + a.price, 0);
}

export function cartTotals(lines: CartLine[]) {
  return lines.reduce(
    (t, l) => ({ drinks: t.drinks + l.qty, total: t.total + unitPrice(l) * l.qty }),
    { drinks: 0, total: 0 },
  );
}

/** Same drink with the same add-ons stacks into one line. */
export function addLine(lines: CartLine[], line: Omit<CartLine, "key" | "qty">): CartLine[] {
  const key = lineKey(line.itemId, line.addons.map((a) => a.id));
  const existing = lines.find((l) => l.key === key);
  if (existing) return lines.map((l) => (l.key === key ? { ...l, qty: Math.min(l.qty + 1, MAX_LINE_QTY) } : l));
  return [...lines, { ...line, key, qty: 1 }];
}

export function removeOne(lines: CartLine[], key: string): CartLine[] {
  return setQty(lines, key, (lines.find((l) => l.key === key)?.qty ?? 0) - 1);
}

/** Sets a line's quantity (clamped to 0–10); 0 removes the line. */
export function setQty(lines: CartLine[], key: string, qty: number): CartLine[] {
  const q = Math.max(0, Math.min(MAX_LINE_QTY, Math.floor(qty)));
  return lines.map((l) => (l.key === key ? { ...l, qty: q } : l)).filter((l) => l.qty > 0);
}

export function removeLine(lines: CartLine[], key: string): CartLine[] {
  return lines.filter((l) => l.key !== key);
}

export function setNote(lines: CartLine[], key: string, note: string): CartLine[] {
  return lines.map((l) => (l.key === key ? { ...l, note: note.slice(0, MAX_NOTE) } : l));
}

/** Mirrors create_order's rule: Egyptian mobile → +201xxxxxxxxx, else null. */
export function normalizeEgPhone(input: string): string | null {
  let d = input.replace(/\D/g, "");
  if (d.startsWith("0020")) d = d.slice(2);
  if (/^01[0125]\d{8}$/.test(d)) return `+2${d}`;
  if (/^201[0125]\d{8}$/.test(d)) return `+${d}`;
  return null;
}

function to12h(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h < 12 ? "AM" : "PM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return { text: m ? `${hour}:${String(m).padStart(2, "0")}` : String(hour), suffix };
}

/** "08:00:00","09:00:00" → "8 – 9 AM"; "11:30","12:00" → "11:30 AM – 12 PM". */
export function formatSlotTime(start: string, end: string): string {
  const a = to12h(start);
  const b = to12h(end);
  return a.suffix === b.suffix ? `${a.text} – ${b.text} ${b.suffix}` : `${a.text} ${a.suffix} – ${b.text} ${b.suffix}`;
}

/** "2026-11-26" relative to today ("2026-11-25") → "Tomorrow"; later days → "Fri 27". */
export function dayLabel(day: string, today: string): { label: string; sub: string } {
  const d = new Date(`${day}T00:00:00Z`);
  const t = new Date(`${today}T00:00:00Z`);
  const diff = Math.round((d.getTime() - t.getTime()) / 86_400_000);
  const weekday = d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
  const sub = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  return { label: diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : weekday, sub };
}

export const ORDER_ERRORS: Record<string, string> = {
  INVALID_NAME: "Please enter your name.",
  INVALID_PHONE: "Please enter a valid Egyptian mobile number, like 01xxxxxxxxx.",
  INVALID_NOTES: "Notes are too long (500 characters max).",
  INVALID_ITEMS: "Something's off with your basket. Please review it and try again.",
  ITEM_UNAVAILABLE: "One of your drinks isn't available right now. Please update your basket.",
  SLOT_UNAVAILABLE: "That pickup time isn't available anymore. Please pick another.",
  SLOT_FULL: "That pickup slot just filled up. Please pick another time.",
  TOO_MANY_PENDING: "You already have 2 orders waiting for payment. Please pay or wait for them to expire.",
};
