import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../db.js";
import { badRequest, conflict, notFound } from "../lib/errors.js";
import { scheduledAtFor, todayKey } from "../lib/time.js";
import { ensureRefillAlert, resolveAlertsIfStockHealthy } from "./refillService.js";
import { notify } from "./notificationService.js";

type Tx = Prisma.TransactionClient | PrismaClient;

export function parseTimes(timesJson: string): string[] {
  try {
    const parsed = JSON.parse(timesJson);
    if (Array.isArray(parsed)) return parsed.filter((t) => typeof t === "string");
  } catch {
    /* fall through */
  }
  return [];
}

function medActiveOn(med: { startDate: Date; endDate: Date | null }, dateKey: string): boolean {
  const dayStart = scheduledAtFor(dateKey, "00:00");
  const dayEnd = scheduledAtFor(dateKey, "23:59");
  if (med.startDate > dayEnd) return false;
  if (med.endDate && med.endDate < dayStart) return false;
  return true;
}

/**
 * Create PENDING dose log rows for every scheduled time of a medication on a
 * date. Idempotent thanks to the (medicationId, dateKey, timeStr) unique key.
 */
export async function materializeDosesForUser(userId: string, dateKey: string, tx: Tx = prisma) {
  const meds = await tx.medication.findMany({
    where: { userId, status: "ACTIVE" },
  });
  for (const med of meds) {
    if (!medActiveOn(med, dateKey)) continue;
    for (const timeStr of parseTimes(med.times)) {
      await tx.doseLog.upsert({
        where: {
          medicationId_dateKey_timeStr: { medicationId: med.id, dateKey, timeStr },
        },
        create: {
          medicationId: med.id,
          userId,
          dateKey,
          timeStr,
          scheduledAt: scheduledAtFor(dateKey, timeStr),
          status: "PENDING",
        },
        update: {}, // never overwrite a recorded dose
      });
    }
  }
}

export async function materializeDosesForAllUsers(dateKey: string): Promise<number> {
  const meds = await prisma.medication.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, userId: true, times: true, startDate: true, endDate: true },
  });
  let created = 0;
  for (const med of meds) {
    if (!medActiveOn(med, dateKey)) continue;
    for (const timeStr of parseTimes(med.times)) {
      try {
        await prisma.doseLog.upsert({
          where: {
            medicationId_dateKey_timeStr: { medicationId: med.id, dateKey, timeStr },
          },
          create: {
            medicationId: med.id,
            userId: med.userId,
            dateKey,
            timeStr,
            scheduledAt: scheduledAtFor(dateKey, timeStr),
            status: "PENDING",
          },
          update: {},
        });
        created++;
      } catch {
        /* concurrent materialization race is fine (unique key) */
      }
    }
  }
  return created;
}

/** Get (and materialize) the dose schedule for a user on a date. */
export async function getScheduleForDate(userId: string, dateKey: string, now = new Date()) {
  await materializeDosesForUser(userId, dateKey);
  const doses = await prisma.doseLog.findMany({
    where: { userId, dateKey },
    include: {
      medication: {
        select: {
          id: true, name: true, doseAmount: true, doseUnit: true,
          quantityPerDose: true, quantityUnit: true, currentQuantity: true,
          refillThreshold: true, status: true,
        },
      },
    },
    orderBy: { scheduledAt: "asc" },
  });
  return doses.map((d) => ({
    ...d,
    isOverdue: d.status === "PENDING" && d.scheduledAt < now && (!d.snoozedUntil || d.snoozedUntil < now),
    isSnoozed: d.status === "PENDING" && !!d.snoozedUntil && d.snoozedUntil > now,
    effectiveAt: d.snoozedUntil ?? d.scheduledAt,
  }));
}

/**
 * Record a dose action (TAKEN / SKIPPED / SNOOZE).
 *
 * - Duplicate submissions are rejected: the status transition uses an
 *   atomic update guarded on status = PENDING, and DoseLog rows are unique
 *   per (medication, date, time), so inventory can never be deducted twice.
 * - TAKEN deducts `medication.quantityPerDose` from current stock inside a
 *   transaction and re-checks the refill threshold (raising alert + auto
 *   request when crossed).
 * - SKIPPED never deducts inventory (no rule currently requires it).
 * - SNOOZE keeps the dose PENDING with a new snoozedUntil and re-arms the
 *   reminder, preventing duplicate active reminders for the same dose.
 */
export async function recordDoseAction(
  userId: string,
  doseId: string,
  action: "TAKEN" | "SKIPPED" | "SNOOZE",
  snoozeMinutes = 10,
  now = new Date()
) {
  const dose = await prisma.doseLog.findUnique({
    where: { id: doseId },
    include: { medication: true },
  });
  if (!dose || dose.userId !== userId) throw notFound("Dose not found.");
  if (dose.status !== "PENDING") {
    throw conflict("This dose has already been recorded.", "DOSE_ALREADY_RECORDED");
  }

  if (action === "SNOOZE") {
    const until = new Date(now.getTime() + snoozeMinutes * 60_000);
    const guard = await prisma.doseLog.updateMany({
      where: { id: doseId, status: "PENDING" },
      data: { snoozedUntil: until, reminderSentAt: null, actionAt: now },
    });
    if (guard.count === 0) throw conflict("This dose has already been recorded.");
    await notify({
      userId,
      type: "DOSE_REMINDER",
      title: `Snoozed: ${dose.medication.name}`,
      body: `Reminder rescheduled for ${until.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`,
      link: "/app/schedule",
    });
    return prisma.doseLog.findUnique({ where: { id: doseId }, include: { medication: true } });
  }

  if (action === "SKIPPED") {
    const guard = await prisma.doseLog.updateMany({
      where: { id: doseId, status: "PENDING" },
      data: { status: "SKIPPED", actionAt: now, quantityDelta: 0, snoozedUntil: null },
    });
    if (guard.count === 0) throw conflict("This dose has already been recorded.");
    return prisma.doseLog.findUnique({ where: { id: doseId }, include: { medication: true } });
  }

  // ---- TAKEN (transactional: inventory + threshold check together) ----
  const result = await prisma.$transaction(async (tx) => {
    const guard = await tx.doseLog.updateMany({
      where: { id: doseId, status: "PENDING" },
      data: { status: "PENDING" }, // touch; real update below inside tx
    });
    if (guard.count === 0) throw conflict("This dose has already been recorded.");

    const med = await tx.medication.findUnique({ where: { id: dose.medicationId } });
    if (!med) throw notFound("Medication not found.");

    const requested = med.quantityPerDose;
    // Never allow negative stock: deduct what is available.
    const deducted = Math.min(requested, Math.max(0, med.currentQuantity));
    const newQty = Math.max(0, med.currentQuantity - deducted);

    const updatedDose = await tx.doseLog.update({
      where: { id: doseId },
      data: {
        status: "TAKEN",
        actionAt: now,
        snoozedUntil: null,
        quantityDelta: -deducted,
      },
    });
    await tx.medication.update({
      where: { id: med.id },
      data: { currentQuantity: newQty },
    });
    if (newQty <= med.refillThreshold) {
      await ensureRefillAlert(tx, med.id);
    }
    return { dose: updatedDose, deducted, newQty };
  }, { timeout: 15000 });

  return prisma.doseLog.findUnique({ where: { id: doseId }, include: { medication: true } }).then((d) => ({ ...d, _deducted: result.deducted }));
}

/** Manual inventory correction by the patient (e.g. restocked without chemist). */
export async function adjustInventory(userId: string, medicationId: string, newQuantity: number) {
  if (newQuantity < 0) throw badRequest("Quantity cannot be negative.");
  const med = await prisma.medication.findFirst({ where: { id: medicationId, userId } });
  if (!med) throw notFound("Medication not found.");
  const updated = await prisma.$transaction(async (tx) => {
    const m = await tx.medication.update({
      where: { id: medicationId },
      data: { currentQuantity: newQuantity },
    });
    if (newQuantity <= m.refillThreshold) await ensureRefillAlert(tx, medicationId);
    else await resolveAlertsIfStockHealthy(tx, medicationId);
    return m;
  });
  return updated;
}
