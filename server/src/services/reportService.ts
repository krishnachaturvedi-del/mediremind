import { prisma } from "../db.js";
import { todayKey } from "../lib/time.js";

export type ReportQuery = {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  status?: string;
  medicationId?: string;
};

/**
 * Adherence rules (documented in the README):
 * - Only dose logs inside [from, to] are counted.
 * - TAKEN / SKIPPED count as recorded doses.
 * - A PENDING dose on a PAST date counts as MISSED.
 * - A PENDING dose in the past today counts as OVERDUE (still actionable).
 * - Future doses are reported as SCHEDULED and NEVER count as missed.
 */
export async function doseReport(userId: string, q: ReportQuery) {
  const logs = await prisma.doseLog.findMany({
    where: {
      userId,
      dateKey: { gte: q.from, lte: q.to },
      ...(q.medicationId ? { medicationId: q.medicationId } : {}),
      ...(q.status && q.status !== "ALL" ? { status: q.status } : {}),
    },
    include: {
      medication: { select: { id: true, name: true, doseUnit: true, quantityUnit: true } },
    },
    orderBy: { scheduledAt: "desc" },
    take: 1000,
  });
  const today = todayKey();
  const now = new Date();

  const rows = logs.map((l) => {
    let effective: string = l.status;
    if (l.status === "PENDING") {
      if (l.dateKey < today) effective = "MISSED";
      else if (l.dateKey === today && l.scheduledAt < now) effective = "OVERDUE";
      else effective = "SCHEDULED";
    }
    return {
      id: l.id,
      dateKey: l.dateKey,
      time: l.timeStr,
      scheduledAt: l.scheduledAt,
      actionAt: l.actionAt,
      status: l.status,
      effectiveStatus: effective,
      snoozedUntil: l.snoozedUntil,
      quantityDelta: l.quantityDelta,
      medication: l.medication,
    };
  });

  const counted = rows.filter((r) => ["TAKEN", "SKIPPED", "MISSED", "OVERDUE"].includes(r.effectiveStatus));
  const taken = rows.filter((r) => r.effectiveStatus === "TAKEN").length;
  const skipped = rows.filter((r) => r.effectiveStatus === "SKIPPED").length;
  const missed = rows.filter((r) => r.effectiveStatus === "MISSED").length;
  const overdue = rows.filter((r) => r.effectiveStatus === "OVERDUE").length;
  const scheduledFuture = rows.filter((r) => r.effectiveStatus === "SCHEDULED").length;
  const adherencePercent =
    counted.length > 0 ? Math.round((taken / counted.length) * 100) : null;

  // Per-medication breakdown.
  const byMedication = new Map<string, { name: string; taken: number; skipped: number; missed: number; overdue: number }>();
  for (const r of rows) {
    const key = r.medication.id;
    const entry = byMedication.get(key) ?? { name: r.medication.name, taken: 0, skipped: 0, missed: 0, overdue: 0 };
    if (r.effectiveStatus === "TAKEN") entry.taken++;
    else if (r.effectiveStatus === "SKIPPED") entry.skipped++;
    else if (r.effectiveStatus === "MISSED") entry.missed++;
    else if (r.effectiveStatus === "OVERDUE") entry.overdue++;
    byMedication.set(key, entry);
  }

  return {
    rows,
    summary: {
      total: rows.length,
      taken,
      skipped,
      missed,
      overdue,
      scheduledFuture,
      adherencePercent,
    },
    byMedication: [...byMedication.entries()].map(([id, v]) => ({ medicationId: id, ...v })),
  };
}

/** Daily counts for the last `days` days (for charts). */
export async function dailyTrend(userId: string, days = 14) {
  const today = todayKey();
  const from = shift(today, -(days - 1));
  const logs = await prisma.doseLog.findMany({
    where: { userId, dateKey: { gte: from, lte: today } },
    select: { dateKey: true, status: true },
  });
  const map = new Map<string, { taken: number; skipped: number; pending: number }>();
  for (let i = days - 1; i >= 0; i--) {
    map.set(shift(today, -i), { taken: 0, skipped: 0, pending: 0 });
  }
  for (const l of logs) {
    const e = map.get(l.dateKey);
    if (!e) continue;
    if (l.status === "TAKEN") e.taken++;
    else if (l.status === "SKIPPED") e.skipped++;
    else e.pending++;
  }
  return [...map.entries()].map(([date, counts]) => ({ date, ...counts }));
}

function shift(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export async function refillReport(userId: string, q: { from: string; to: string }) {
  const transactions = await prisma.refillTransaction.findMany({
    where: {
      medication: { userId },
      confirmedAt: {
        gte: new Date(`${q.from}T00:00:00`),
        lte: new Date(`${q.to}T23:59:59`),
      },
    },
    include: {
      medication: { select: { name: true, quantityUnit: true } },
      chemist: { select: { name: true } },
    },
    orderBy: { confirmedAt: "desc" },
    take: 500,
  });
  return transactions;
}

export function toCsv(rows: Record<string, unknown>[], headers: string[]): string {
  const esc = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) lines.push(headers.map((h) => esc(r[h])).join(","));
  return lines.join("\n");
}
