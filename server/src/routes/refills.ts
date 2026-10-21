import { Router } from "express";
import { requireAuth, requireRole, type AuthedRequest } from "../middleware/auth.js";
import { validateBody } from "../middleware/error.js";
import { prisma } from "../db.js";
import {
  listPatientRefills,
  createPatientRefillRequest,
  cancelPatientRefillRequest,
  listChemistRefills,
  listChemistTransactions,
  chemistActOnRefill,
  chemistShopOf,
} from "../services/refillService.js";
import { refillRequestSchema, refillStatusSchema } from "../validation.js";

export const refillsRouter = Router();
refillsRouter.use(requireAuth, requireRole("PATIENT"));

refillsRouter.get("/", async (req: AuthedRequest, res, next) => {
  try {
    const data = await listPatientRefills(req.user!.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

refillsRouter.post("/", validateBody(refillRequestSchema), async (req: AuthedRequest, res, next) => {
  try {
    const request = await createPatientRefillRequest(req.user!.id, req.body);
    res.status(201).json({ request });
  } catch (err) {
    next(err);
  }
});

refillsRouter.post("/:id/cancel", async (req: AuthedRequest, res, next) => {
  try {
    const request = await cancelPatientRefillRequest(req.user!.id, req.params.id);
    res.json({ request });
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------------------ chemist endpoints

export const chemistRouter = Router();
chemistRouter.use(requireAuth, requireRole("CHEMIST"));

chemistRouter.get("/refills", async (req: AuthedRequest, res, next) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const requests = await listChemistRefills(req.user!.id, status);
    res.json({ requests });
  } catch (err) {
    next(err);
  }
});

chemistRouter.get("/transactions", async (req: AuthedRequest, res, next) => {
  try {
    const transactions = await listChemistTransactions(req.user!.id);
    res.json({ transactions });
  } catch (err) {
    next(err);
  }
});

chemistRouter.post(
  "/refills/:id/action",
  validateBody(refillStatusSchema),
  async (req: AuthedRequest, res, next) => {
    try {
      const result = await chemistActOnRefill(
        req.user!.id,
        req.params.id,
        req.body.action,
        {
          quantitySupplied: req.body.quantitySupplied,
          rejectReason: req.body.rejectReason,
          ip: req.ip,
        }
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

/** Registered patients of this chemist's shop (names only for fulfilment). */
chemistRouter.get("/patients", async (req: AuthedRequest, res, next) => {
  try {
    const shop = await chemistShopOf(req.user!.id);
    const links = await prisma.patientChemist.findMany({
      where: { chemistShopId: shop.id, status: "ACTIVE" },
      include: { patient: { select: { id: true, name: true, phone: true } } },
    });
    res.json({
      shop: { id: shop.id, name: shop.name, address: shop.address, phone: shop.phone },
      patients: links.map((l) => l.patient),
    });
  } catch (err) {
    next(err);
  }
});
