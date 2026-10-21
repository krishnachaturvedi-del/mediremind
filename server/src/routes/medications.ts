import { Router } from "express";
import { z } from "zod";
import { medicationSchema, medicationUpdateSchema } from "../validation.js";
import { validateBody } from "../middleware/error.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import {
  createMedication,
  listMedications,
  getMedication,
  updateMedication,
  setMedicationStatus,
} from "../services/medicationService.js";
import { estimatedDaysLeft, inventoryStatus } from "../services/medicationService.js";

export const medicationsRouter = Router();
medicationsRouter.use(requireAuth);

const listQuerySchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
});

medicationsRouter.get("/", async (req: AuthedRequest, res, next) => {
  try {
    const query = listQuerySchema.parse(req.query);
    const meds = await listMedications(req.user!.id, query);
    res.json({
      medications: meds.map((m) => ({
        ...m,
        times: JSON.parse(m.times) as string[],
        inventoryStatus: inventoryStatus(m),
        estimatedDaysLeft: estimatedDaysLeft(m),
      })),
    });
  } catch (err) {
    next(err);
  }
});

medicationsRouter.post("/", validateBody(medicationSchema), async (req: AuthedRequest, res, next) => {
  try {
    const med = await createMedication(req.user!.id, req.body, req.ip);
    res.status(201).json({ medication: { ...med, times: JSON.parse(med.times) } });
  } catch (err) {
    next(err);
  }
});

medicationsRouter.get("/:id", async (req: AuthedRequest, res, next) => {
  try {
    const med = await getMedication(req.user!.id, req.params.id);
    res.json({ medication: { ...med, times: JSON.parse(med.times), inventoryStatus: inventoryStatus(med), estimatedDaysLeft: estimatedDaysLeft(med) } });
  } catch (err) {
    next(err);
  }
});

medicationsRouter.patch("/:id", validateBody(medicationUpdateSchema), async (req: AuthedRequest, res, next) => {
  try {
    const med = await updateMedication(req.user!.id, req.params.id, req.body, req.ip);
    res.json({ medication: { ...med, times: JSON.parse(med.times) } });
  } catch (err) {
    next(err);
  }
});

const statusSchema = z.object({ status: z.enum(["ACTIVE", "PAUSED", "ENDED"]) });
medicationsRouter.post("/:id/status", validateBody(statusSchema), async (req: AuthedRequest, res, next) => {
  try {
    const med = await setMedicationStatus(req.user!.id, req.params.id, req.body.status, req.ip);
    res.json({ medication: med });
  } catch (err) {
    next(err);
  }
});
