// Parsing for admin form input. Server actions are public endpoints, so every field is re-validated here.

export type ActionResult = { ok: boolean; message: string };

export class InputError extends Error {}

export function text(fd: FormData, key: string, { min = 0, max = 200 } = {}): string {
  const v = String(fd.get(key) ?? "").trim();
  if (v.length < min) throw new InputError(`${label(key)} is required.`);
  if (v.length > max) throw new InputError(`${label(key)} is too long (max ${max}).`);
  return v;
}

export function num(fd: FormData, key: string, { min = 0, max = 1_000_000, int = false } = {}): number {
  const raw = String(fd.get(key) ?? "").trim();
  const v = Number(raw);
  if (raw === "" || !Number.isFinite(v)) throw new InputError(`${label(key)} must be a number.`);
  if (int && !Number.isInteger(v)) throw new InputError(`${label(key)} must be a whole number.`);
  if (v < min || v > max) throw new InputError(`${label(key)} must be between ${min} and ${max}.`);
  return v;
}

export function oneOf<T extends string>(fd: FormData, key: string, allowed: readonly T[]): T {
  const v = String(fd.get(key) ?? "");
  if (!allowed.includes(v as T)) throw new InputError(`${label(key)} is not valid.`);
  return v as T;
}

export function bool(fd: FormData, key: string): boolean {
  return fd.get(key) === "on";
}

/** "HH:MM" (or "HH:MM:SS" from the DB) → "HH:MM". */
export function time(fd: FormData, key: string): string {
  const v = String(fd.get(key) ?? "");
  const m = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/.exec(v);
  if (!m) throw new InputError(`${label(key)} must be a time like 08:00.`);
  return `${m[1]}:${m[2]}`;
}

/** Optional "YYYY-MM-DD"; empty → null. */
export function optionalDate(fd: FormData, key: string): string | null {
  const v = String(fd.get(key) ?? "").trim();
  if (!v) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) throw new InputError(`${label(key)} is not a valid date.`);
  return v;
}

export function uuid(v: unknown): string {
  const s = String(v ?? "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) throw new InputError("Invalid id.");
  return s;
}

function label(key: string) {
  return key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}
