import { Router } from "express";
import { requireAuth, requireRole, type AuthedRequest } from "../middleware/auth.js";
import { validateBody } from "../middleware/error.js";
import { prisma } from "../db.js";
import { badRequest } from "../lib/errors.js";
import {
  inviteCaregiver,
  respondToCaregiverInvite,
  listLinksForPatient,
  listLinksForCaregiver,
  updateCaregiverScopes,
  revokeCaregiver,
  caregiverPatientSummary,
} from "../services/caregiverService.js";
import {
  linkPatientChemist,
  unlinkPatientChemist,
} from "../services/refillService.js";
import {
  caregiverInviteSchema,
  caregiverScopeSchema,
} from "../validation.js";

export const caregiverRouter = Router();
caregiverRouter.use(requireAuth);

// ---- patient side ---------------------------------------------------------

caregiverRouter.get("/links", async (req: AuthedRequest, res, next) => {
  try {
    const links = await listLinksForPatient(req.user!.id);
    res.json({ links });
  } catch (err) {
    next(err);
  }
});

caregiverRouter.post(
  "/invite",
  requireRole("PATIENT"),
  validateBody(caregiverInviteSchema),
  async (req: AuthedRequest, res, next) => {
    try {
      const link = await inviteCaregiver(req.user!.id, req.user!.name, req.body, req.ip);
      res.status(201).json({ link });
    } catch (err) {
      next(err);
    }
  }
);

caregiverRouter.patch(
  "/links/:id/scopes",
  requireRole("PATIENT"),
  validateBody(caregiverScopeSchema),
  async (req: AuthedRequest, res, next) => {
    try {
      const link = await updateCaregiverScopes(req.user!.id, req.params.id, req.body);
      res.json({ link });
    } catch (err) {
      next(err);
    }
  }
);

caregiverRouter.delete("/links/:id", requireRole("PATIENT"), async (req: AuthedRequest, res, next) => {
  try {
    const link = await revokeCaregiver(req.user!.id, req.params.id, req.ip);
    res.json({ link });
  } catch (err) {
    next(err);
  }
});

// ---- caregiver side -------------------------------------------------------

caregiverRouter.get("/invitations", requireRole("CAREGIVER"), async (req: AuthedRequest, res, next) => {
  try {
    const links = await listLinksForCaregiver(req.user!.id);
    res.json({ links });
  } catch (err) {
    next(err);
  }
});

caregiverRouter.post(
  "/invitations/:id/respond",
  requireRole("CAREGIVER"),
  async (req: AuthedRequest, res, next) => {
    try {
      const accept = req.body?.accept === true;
      const link = await respondToCaregiverInvite(req.user!.id, req.params.id, accept, req.ip);
      res.json({ link });
    } catch (err) {
      next(err);
    }
  }
);

caregiverRouter.get("/patients", requireRole("CAREGIVER"), async (req: AuthedRequest, res, next) => {
  try {
    const links = await listLinksForCaregiver(req.user!.id);
    res.json({
      patients: links
        .filter((l) => l.status === "ACTIVE")
        .map((l) => ({ id: l.patient.id, name: l.patient.name, since: l.updatedAt })),
    });
  } catch (err) {
    next(err);
  }
});

caregiverRouter.get(
  "/patients/:id/summary",
  requireRole("CAREGIVER"),
  async (req: AuthedRequest, res, next) => {
    try {
      const summary = await caregiverPatientSummary(req.user!.id, req.params.id);
      res.json(summary);
    } catch (err) {
      next(err);
    }
  }
);

// ---- chemist shop selection (patients) ------------------------------------

export const shopsRouter = Router();
shopsRouter.use(requireAuth, requireRole("PATIENT"));

shopsRouter.get("/", async (_req, res, next) => {
  try {
    const shops = await prisma.chemistShop.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, address: true, phone: true, licenseNumber: true },
    });
    res.json({ shops });
  } catch (err) {
    next(err);
  }
});

shopsRouter.get("/mine", async (req: AuthedRequest, res, next) => {
  try {
    const link = await prisma.patientChemist.findUnique({
      where: { patientId: req.user!.id },
      include: {
        chemistShop: {
          select: { id: true, name: true, address: true, phone: true, licenseNumber: true },
        },
      },
    });
    res.json({ link: link && link.status === "ACTIVE" ? link : null });
  } catch (err) {
    next(err);
  }
});

shopsRouter.post("/link", async (req: AuthedRequest, res, next) => {
  try {
    const shopId = req.body?.chemistShopId;
    if (!shopId || typeof shopId !== "string") throw badRequest("chemistShopId is required.");
    const result = await linkPatientChemist(req.user!.id, shopId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

shopsRouter.post("/unlink", async (req: AuthedRequest, res, next) => {
  try {
    const link = await unlinkPatientChemist(req.user!.id);
    res.json({ link });
  } catch (err) {
    next(err);
  }
});
