// Last few orders placed on this device (localStorage only; nothing personal beyond the order code + pickup label).
const KEY = "nz-recent-orders-v1";
const MAX = 5;
type Recent = { code: string; label: string };

let cache: { raw: string | null; value: Recent[] } = { raw: null, value: [] };

export function readRecentOrders(): Recent[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(KEY);
  if (raw === cache.raw) return cache.value; // stable reference for useSyncExternalStore
  let value: Recent[] = [];
  try {
    const parsed = JSON.parse(raw ?? "[]");
    if (Array.isArray(parsed)) value = parsed.filter((o) => typeof o?.code === "string" && /^[A-HJ-NP-Z2-9]{8}$/.test(o.code)).slice(0, MAX);
  } catch {}
  cache = { raw, value };
  return value;
}

export function rememberOrder(code: string, label: string) {
  try {
    const next = [{ code, label }, ...readRecentOrders().filter((o) => o.code !== code)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
}
