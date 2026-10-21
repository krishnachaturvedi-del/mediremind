import { Router } from "express";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import {
  listNotifications,
  markRead,
  markAllRead,
} from "../services/notificationService.js";
import { prisma } from "../db.js";
import { profileUpdateSchema, changePasswordSchema } from "../validation.js";
import { validateBody } from "../middleware/error.js";
import { changePassword } from "../services/authService.js";
import { patientDashboard } from "../services/dashboardService.js";

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get("/", async (req: AuthedRequest, res, next) => {
  try {
    const unreadOnly = req.query.unread === "true";
    const [notifications, unreadCount] = await Promise.all([
      listNotifications(req.user!.id, unreadOnly),
      prisma.notification.count({ where: { userId: req.user!.id, read: false } }),
    ]);
    res.json({ notifications, unreadCount });
  } catch (err) {
    next(err);
  }
});

notificationsRouter.post("/read-all", async (req: AuthedRequest, res, next) => {
  try {
    const count = await markAllRead(req.user!.id);
    res.json({ updated: count });
  } catch (err) {
    next(err);
  }
});

notificationsRouter.post("/:id/read", async (req: AuthedRequest, res, next) => {
  try {
    const count = await markRead(req.user!.id, req.params.id);
    res.json({ updated: count });
  } catch (err) {
    next(err);
  }
});

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

dashboardRouter.get("/", async (req: AuthedRequest, res, next) => {
  try {
    const data = await patientDashboard(req.user!.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export const profileRouter = Router();
profileRouter.use(requireAuth);

profileRouter.get("/", async (req: AuthedRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, email: true, name: true, role: true, phone: true, createdAt: true },
    });
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

profileRouter.patch("/", validateBody(profileUpdateSchema), async (req: AuthedRequest, res, next) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        ...(req.body.name !== undefined ? { name: req.body.name } : {}),
        ...(req.body.phone !== undefined ? { phone: req.body.phone || null } : {}),
      },
      select: { id: true, email: true, name: true, role: true, phone: true },
    });
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

profileRouter.post(
  "/change-password",
  validateBody(changePasswordSchema),
  async (req: AuthedRequest, res, next) => {
    try {
      await changePassword({
        userId: req.user!.id,
        currentPassword: req.body.currentPassword,
        newPassword: req.body.newPassword,
        ip: req.ip,
      });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);
