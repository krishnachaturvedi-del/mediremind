import { Router } from "express";
import { z } from "zod";
import { doseActionSchema } from "../validation.js";
import { validateBody } from "../middleware/error.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { getScheduleForDate, recordDoseAction } from "../services/scheduleService.js";
import { badRequest } from "../lib/errors.js";

export const dosesRouter = Router();
dosesRouter.use(requireAuth);

const dateQuery = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

dosesRouter.get("/", async (req: AuthedRequest, res, next) => {
  try {
    const { date } = dateQuery.parse(req.query);
    const now = new Date();
    const dateKey = date ?? new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD local
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) throw badRequest("Invalid date.");
    const doses = await getScheduleForDate(req.user!.id, dateKey, now);
    res.json({ date: dateKey, doses });
  } catch (err) {
    next(err);
  }
});

dosesRouter.post("/:id/action", validateBody(doseActionSchema), async (req: AuthedRequest, res, next) => {
  try {
    const { action, snoozeMinutes } = req.body;
    const dose = await recordDoseAction(
      req.user!.id,
      req.params.id,
      action,
      snoozeMinutes ?? 10
    );
    res.json({ dose });
  } catch (err) {
    next(err);
  }
});
