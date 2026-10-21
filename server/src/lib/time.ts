// Local-time helpers. Doses are scheduled in the server's local timezone;
// dateKey is "YYYY-MM-DD" and timeStr is "HH:mm".

export function dateKeyOf(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayKey(now: Date = new Date()): string {
  return dateKeyOf(now);
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
export function isValidTimeStr(t: string): boolean {
  return TIME_RE.test(t);
}

/** Build the UTC timestamp for a local "YYYY-MM-DD" + "HH:mm". */
export function scheduledAtFor(dateKey: string, timeStr: string): Date {
  return new Date(`${dateKey}T${timeStr}:00`);
}

export function timeStrOf(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Shift a date key by whole days. */
export function shiftDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return dateKeyOf(dt);
}

/** Human friendly "8:00 AM". */
export function formatTime12(timeStr: string): string {
  const [hStr, mStr] = timeStr.split(":");
  const h = Number(hStr);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mStr} ${ampm}`;
}

export function formatDateLong(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
