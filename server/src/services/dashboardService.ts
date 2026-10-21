import { prisma } from "../db.js";
import { todayKey, formatDateLong } from "../lib/time.js";
import { getScheduleForDate } from "./scheduleService.js";
import { inventoryStatus, estimatedDaysLeft } from "./medicationService.js";

/** Aggregated patient dashboard figures — all computed from stored data. */
export async function patientDashboard(userId: string, now = new Date()) {
  const today = todayKey(now);
  const [doses, meds, pendingRefills, user, recentDoseLogs, recentRefills] =
    await Promise.all([
      getScheduleForDate(userId, today, now),
      prisma.medication.findMany({ where: { userId } }),
      prisma.refillRequest.count({
        where: { userId, status: { in: ["PENDING", "ACCEPTED", "READY"] } },
      }),
      prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
      prisma.doseLog.findMany({
        where: { userId, status: { in: ["TAKEN", "SKIPPED"] } },
        include: { medication: { select: { name: true, quantityUnit: true } } },
        orderBy: { actionAt: "desc" },
        take: 8,
      }),
      prisma.refillRequest.findMany({
        where: { userId },
        include: { medication: { select: { name: true } } },
        orderBy: { updatedAt: "desc" },
        take: 5,
      }),
    ]);

  const activeMeds = meds.filter((m) => m.status === "ACTIVE");
  const takenToday = doses.filter((d) => d.status === "TAKEN").length;
  const skippedToday = doses.filter((d) => d.status === "SKIPPED").length;
  const pendingToday = doses.filter((d) => d.status === "PENDING");
  const overdueToday = pendingToday.filter((d) => d.isOverdue).length;

  const upcoming = [...pendingToday]
    .filter((d) => d.effectiveAt >= now)
    .sort((a, b) => a.effectiveAt.getTime() - b.effectiveAt.getTime());
  const overdue = [...pendingToday]
    .filter((d) => d.effectiveAt < now)
    .sort((a, b) => a.effectiveAt.getTime() - b.effectiveAt.getTime());
  const nextDose = overdue[0] ?? upcoming[0] ?? null;

  const inventory = activeMeds.map((m) => ({
    id: m.id,
    name: m.name,
    currentQuantity: m.currentQuantity,
    quantityUnit: m.quantityUnit,
    refillThreshold: m.refillThreshold,
    status: inventoryStatus(m),
    estimatedDaysLeft: estimatedDaysLeft(m),
  }));
  const lowStock = inventory.filter((i) => i.status !== "IN_STOCK");

  return {
    user: { name: user?.name ?? "" },
    date: { key: today, label: formatDateLong(today) },
    schedule: {
      total: doses.length,
      taken: takenToday,
      skipped: skippedToday,
      pending: pendingToday.length,
      overdue: overdueToday,
      doses: doses.map((d) => ({
        id: d.id,
        time: d.timeStr,
        timeStr: d.timeStr,
        scheduledAt: d.scheduledAt,
        snoozedUntil: d.snoozedUntil,
        status: d.status,
        isOverdue: d.isOverdue,
        isSnoozed: d.isSnoozed,
        medication: d.medication,
      })),
    },
    nextDose: nextDose
      ? {
          id: nextDose.id,
          time: nextDose.timeStr,
          effectiveAt: nextDose.effectiveAt,
          isOverdue: nextDose.isOverdue,
          medication: nextDose.medication,
        }
      : null,
    upcoming: upcoming.slice(0, 5).map((d) => ({
      id: d.id,
      time: d.timeStr,
      effectiveAt: d.effectiveAt,
      medication: d.medication,
    })),
    medications: {
      total: meds.length,
      active: activeMeds.length,
      paused: meds.filter((m) => m.status === "PAUSED").length,
      items: inventory,
    },
    inventory: { lowStockCount: lowStock.length, lowStock },
    refills: {
      pendingCount: pendingRefills,
      recent: recentRefills.map((r) => ({
        id: r.id,
        medication: r.medication.name,
        status: r.status,
        updatedAt: r.updatedAt,
      })),
    },
    recentActivity: recentDoseLogs.map((d) => ({
      id: d.id,
      medication: d.medication.name,
      status: d.status,
      actionAt: d.actionAt,
      quantityDelta: d.quantityDelta,
    })),
    hasMedications: meds.length > 0,
  };
}
