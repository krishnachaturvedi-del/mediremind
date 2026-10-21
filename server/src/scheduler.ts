import { prisma } from "./db.js";
import { materializeDosesForAllUsers } from "./services/scheduleService.js";
import { notify } from "./services/notificationService.js";
import { todayKey } from "./lib/time.js";
import { log } from "./lib/audit.js";

/**
 * In-process reminder scheduler.
 *
 * Design: polls the database every `TICK_MS` (10s). Doses whose effective due
 * time (scheduled time, or snoozedUntil after a snooze) has arrived and that
 * have not yet been reminded produce an in-app notification, which the
 * frontend polls and can surface through the browser Notification API.
 *
 * HONEST LIMITATIONS:
 * - Delivery precision is bounded by the polling interval (0–10s here) and by
 *   process/host scheduling. A guaranteed ±10s delivery window requires a
 *   dedicated job scheduler/queue with monitoring; that infrastructure is not
 *   part of this development environment.
 * - Notifications are delivered in-app only. No email/SMS/push provider is
 *   configured. Browser notifications work only while the tab (or a worker
 *   page) is open.
 * - For a multi-instance deployment this scheduler must move to a shared job
 *   runner (e.g. a queue with a single consumer) to avoid duplicate sends.
 */

const TICK_MS = 10_000;
// Do not emit reminders for doses more than 4 hours past due (prevents
// notification floods after the user was offline; the dose stays actionable).
const MAX_REMIND_AGE_MS = 4 * 60 * 60 * 1000;
// A reminder is "due" this many seconds before the exact scheduled time, so
// that with 10s polling the user is reminded within roughly ±10s of schedule.
const LEAD_SECONDS = 0;

let timer: NodeJS.Timeout | null = null;

export async function reminderTick(now = new Date()): Promise<number> {
  const today = todayKey(now);
  await materializeDosesForAllUsers(today);

  const due = await prisma.doseLog.findMany({
    where: {
      dateKey: today,
      status: "PENDING",
      OR: [
        { snoozedUntil: null, scheduledAt: { lte: new Date(now.getTime() - LEAD_SECONDS * 1000) } },
        { snoozedUntil: { lte: now } },
      ],
    },
    include: {
      medication: { select: { id: true, name: true, doseAmount: true, doseUnit: true, currentQuantity: true, quantityUnit: true } },
    },
    take: 200,
  });

  let sent = 0;
  for (const dose of due) {
    const dueAt = dose.snoozedUntil ?? dose.scheduledAt;
    if (now.getTime() - dueAt.getTime() > MAX_REMIND_AGE_MS) continue; // too old
    // Prevent duplicate active reminders for the same dose.
    if (dose.reminderSentAt && (!dose.snoozedUntil || dose.reminderSentAt >= dose.snoozedUntil)) {
      continue;
    }
    const snoozed = !!dose.snoozedUntil;
    try {
      await prisma.notification.create({
        data: {
          userId: dose.userId,
          type: "DOSE_REMINDER",
          title: `${snoozed ? "Snoozed reminder" : "Medication reminder"}: ${dose.medication.name}`,
          body: `Time to take ${dose.medication.doseAmount} ${dose.medication.doseUnit} of ${dose.medication.name} (stock: ${dose.medication.currentQuantity} ${dose.medication.quantityUnit}).`,
          link: "/app/schedule",
        },
      });
      await prisma.doseLog.update({
        where: { id: dose.id },
        data: { reminderSentAt: now },
      });
      sent++;
    } catch (err) {
      log("error", "Failed to emit dose reminder", err);
    }
  }
  return sent;
}

/** Auto-end medications whose end date has passed. */
async function endExpiredMedications(now = new Date()): Promise<void> {
  await prisma.medication.updateMany({
    where: { status: "ACTIVE", endDate: { lt: now } },
    data: { status: "ENDED" },
  });
}

export function startScheduler(): void {
  if (timer) return;
  const run = async () => {
    try {
      await reminderTick();
      await endExpiredMedications();
    } catch (err) {
      log("error", "Scheduler tick failed", err);
    }
  };
  timer = setInterval(run, TICK_MS);
  // Do not keep the process alive solely for the scheduler (helps tests/CLI).
  timer.unref?.();
  log("info", `Reminder scheduler started (polling every ${TICK_MS / 1000}s).`);
}

export function stopScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
