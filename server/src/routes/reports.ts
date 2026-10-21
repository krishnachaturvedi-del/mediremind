import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { doseReport, dailyTrend, refillReport, toCsv } from "../services/reportService.js";
import { badRequest } from "../lib/errors.js";

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

const rangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.string().optional(),
  medicationId: z.string().optional(),
});

function parseRange(req: AuthedRequest) {
  const q = rangeSchema.parse(req.query);
  if (q.to < q.from) throw badRequest("End date must be on or after start date.");
  return q;
}

reportsRouter.get("/doses", async (req: AuthedRequest, res, next) => {
  try {
    const q = parseRange(req);
    const report = await doseReport(req.user!.id, q);
    res.json(report);
  } catch (err) {
    next(err);
  }
});

reportsRouter.get("/doses.csv", async (req: AuthedRequest, res, next) => {
  try {
    const q = parseRange(req);
    const report = await doseReport(req.user!.id, q);
    const csv = toCsv(
      report.rows.map((r) => ({
        date: r.dateKey,
        time: r.time,
        medication: r.medication.name,
        doseUnit: r.medication.doseUnit,
        status: r.effectiveStatus,
        recordedStatus: r.status,
        scheduledAt: r.scheduledAt.toISOString(),
        actionAt: r.actionAt ? r.actionAt.toISOString() : "",
        inventoryDelta: r.quantityDelta,
      })),
      ["date", "time", "medication", "doseUnit", "status", "recordedStatus", "scheduledAt", "actionAt", "inventoryDelta"]
    );
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="mediremind-doses-${q.from}-to-${q.to}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

reportsRouter.get("/trend", async (req: AuthedRequest, res, next) => {
  try {
    const days = Math.min(90, Math.max(7, Number(req.query.days) || 14));
    const trend = await dailyTrend(req.user!.id, days);
    res.json({ trend });
  } catch (err) {
    next(err);
  }
});

reportsRouter.get("/refills", async (req: AuthedRequest, res, next) => {
  try {
    const q = parseRange(req);
    const transactions = await refillReport(req.user!.id, q);
    res.json({ transactions });
  } catch (err) {
    next(err);
  }
});
