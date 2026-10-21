import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { validateBody } from "../middleware/error.js";
import { prisma } from "../db.js";
import { notFound } from "../lib/errors.js";
import { estimatedDaysLeft, inventoryStatus } from "../services/medicationService.js";
import { adjustInventory } from "../services/scheduleService.js";

export const inventoryRouter = Router();
inventoryRouter.use(requireAuth);

/**
 * Remaining Quantity = Previous Remaining − Recorded Quantity Used + Confirmed Refill Quantity.
 * The live value is maintained transactionally on Medication.currentQuantity;
 * this endpoint also returns the full ledger computed from dose logs and
 * confirmed refill transactions so the arithmetic is auditable.
 */
inventoryRouter.get("/", async (req: AuthedRequest, res, next) => {
  try {
    const meds = await prisma.medication.findMany({
      where: { userId: req.user!.id },
      include: {
        refillAlerts: { where: { status: "OPEN" }, take: 1, orderBy: { triggeredAt: "desc" } },
        _count: { select: { refillTransactions: true } },
      },
      orderBy: { name: "asc" },
    });
    res.json({
      inventory: meds.map((m) => ({
        id: m.id,
        name: m.name,
        currentQuantity: m.currentQuantity,
        quantityUnit: m.quantityUnit,
        refillThreshold: m.refillThreshold,
        status: m.status,
        inventoryStatus: inventoryStatus(m),
        estimatedDaysLeft: estimatedDaysLeft(m),
        openAlert: m.refillAlerts[0] ?? null,
        updatedAt: m.updatedAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

inventoryRouter.get("/:id/ledger", async (req: AuthedRequest, res, next) => {
  try {
    const med = await prisma.medication.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (!med) throw notFound("Medication not found.");
    const [doseLogs, transactions] = await Promise.all([
      prisma.doseLog.findMany({
        where: { medicationId: med.id, status: "TAKEN" },
        orderBy: { actionAt: "desc" },
        take: 100,
      }),
      prisma.refillTransaction.findMany({
        where: { medicationId: med.id },
        orderBy: { confirmedAt: "desc" },
        take: 100,
      }),
    ]);
    res.json({
      medication: { id: med.id, name: med.name, quantityUnit: med.quantityUnit, currentQuantity: med.currentQuantity },
      entries: [
        ...doseLogs.map((d) => ({
          id: d.id,
          type: "DOSE_USED",
          delta: d.quantityDelta,
          at: d.actionAt ?? d.scheduledAt,
          label: `Dose taken (${d.dateKey} ${d.timeStr})`,
        })),
        ...transactions.map((t) => ({
          id: t.id,
          type: "REFILL_CONFIRMED",
          delta: t.quantitySupplied,
          at: t.confirmedAt,
          label: `Refill confirmed (+${t.quantitySupplied} ${med.quantityUnit})`,
        })),
      ].sort((a, b) => b.at.getTime() - a.at.getTime()),
    });
  } catch (err) {
    next(err);
  }
});

const adjustSchema = z.object({
  currentQuantity: z.number().nonnegative("Quantity cannot be negative.").max(10000000),
});

inventoryRouter.post("/:id/adjust", validateBody(adjustSchema), async (req: AuthedRequest, res, next) => {
  try {
    const med = await adjustInventory(req.user!.id, req.params.id, req.body.currentQuantity);
    res.json({ medication: med });
  } catch (err) {
    next(err);
  }
});
