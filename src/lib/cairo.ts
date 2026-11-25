// Date/time display in the shop's timezone.
const TZ = "Africa/Cairo";

/** "YYYY-MM-DD" for today (or `offsetDays` from today) in Cairo. */
export function cairoDay(offsetDays = 0): string {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
  return addDays(today, offsetDays);
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function cairoTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
}

export function cairoDateLabel(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

export function cairoDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { timeZone: TZ, weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
}
