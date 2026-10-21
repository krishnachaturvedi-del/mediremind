// Formatting + small pure helpers (unit tested).

export function formatTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatTime12(timeStr: string): string {
  const [hStr, mStr] = timeStr.split(":");
  const h = Number(hStr);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mStr} ${ampm}`;
}

export function formatDateLabel(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatDateTime(iso: string | Date | null): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function relativeTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const diffMs = Date.now() - d.getTime();
  const min = Math.round(diffMs / 60000);
  if (Math.abs(min) < 1) return "just now";
  if (Math.abs(min) < 60) return min > 0 ? `${min} min ago` : `in ${-min} min`;
  const hours = Math.round(min / 60);
  if (Math.abs(hours) < 24) return hours > 0 ? `${hours}h ago` : `in ${-hours}h`;
  const days = Math.round(hours / 24);
  return days > 0 ? `${days}d ago` : `in ${-days}d`;
}

export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function shiftDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export const FREQUENCY_LABELS: Record<string, string> = {
  ONCE_DAILY: "Once daily",
  TWICE_DAILY: "Twice daily",
  THREE_TIMES_DAILY: "Three times daily",
  FOUR_TIMES_DAILY: "Four times daily",
  CUSTOM: "Custom schedule",
};

export const STATUS_META: Record<
  string,
  { label: string; classes: string; dot: string }
> = {
  IN_STOCK: { label: "In stock", classes: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  LOW_STOCK: { label: "Low stock", classes: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500" },
  REFILL_REQUIRED: { label: "Refill required", classes: "bg-red-50 text-red-700 ring-red-200", dot: "bg-red-500" },
  TAKEN: { label: "Taken", classes: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  SKIPPED: { label: "Skipped", classes: "bg-slate-100 text-slate-600 ring-slate-200", dot: "bg-slate-400" },
  PENDING: { label: "Pending", classes: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500" },
  MISSED: { label: "Missed", classes: "bg-red-50 text-red-700 ring-red-200", dot: "bg-red-500" },
  OVERDUE: { label: "Overdue", classes: "bg-red-50 text-red-700 ring-red-200", dot: "bg-red-500" },
  SCHEDULED: { label: "Scheduled", classes: "bg-sky-50 text-sky-700 ring-sky-200", dot: "bg-sky-500" },
  ACCEPTED: { label: "Accepted", classes: "bg-sky-50 text-sky-700 ring-sky-200", dot: "bg-sky-500" },
  READY: { label: "Ready for collection", classes: "bg-teal-50 text-teal-700 ring-teal-200", dot: "bg-teal-500" },
  COMPLETED: { label: "Completed", classes: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  REJECTED: { label: "Rejected", classes: "bg-red-50 text-red-700 ring-red-200", dot: "bg-red-500" },
  CANCELLED: { label: "Cancelled", classes: "bg-slate-100 text-slate-600 ring-slate-200", dot: "bg-slate-400" },
  ACTIVE: { label: "Active", classes: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  PAUSED: { label: "Paused", classes: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500" },
  ENDED: { label: "Ended", classes: "bg-slate-100 text-slate-600 ring-slate-200", dot: "bg-slate-400" },
};

export function statusMeta(status: string) {
  return (
    STATUS_META[status] ?? {
      label: status,
      classes: "bg-slate-100 text-slate-600 ring-slate-200",
      dot: "bg-slate-400",
    }
  );
}
