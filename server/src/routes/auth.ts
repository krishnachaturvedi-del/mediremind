import { Router, type Request } from "express";
import { prisma } from "../db.js";
import { registerSchema, loginSchema, changePasswordSchema } from "../validation.js";
import { validateBody } from "../middleware/error.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rateLimit.js";
import {
  registerPatient,
  loginUser,
  changePassword,
  publicUser,
} from "../services/authService.js";

export const authRouter = Router();

function ipOf(req: Request): string | undefined {
  return req.ip;
}

authRouter.post("/register", authLimiter, validateBody(registerSchema), async (req, res, next) => {
  try {
    const user = await registerPatient({ ...req.body, ip: ipOf(req) });
    await new Promise<void>((resolve, reject) => {
      req.session.regenerate((err) => (err ? reject(err) : resolve()));
    });
    req.session.userId = user.id;
    res.status(201).json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/login", authLimiter, validateBody(loginSchema), async (req, res, next) => {
  try {
    const user = await loginUser({ ...req.body, ip: ipOf(req) });
    await new Promise<void>((resolve, reject) => {
      req.session.regenerate((err) => (err ? reject(err) : resolve()));
    });
    req.session.userId = user.id;
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/logout", async (req, res, next) => {
  try {
    await new Promise<void>((resolve, reject) => {
      req.session.destroy((err) => (err ? reject(err) : resolve()));
    });
    res.clearCookie("mediremind.sid");
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

authRouter.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, email: true, name: true, role: true, phone: true, createdAt: true },
  });
  res.json({ user });
});

authRouter.post(
  "/change-password",
  requireAuth,
  authLimiter,
  validateBody(changePasswordSchema),
  async (req: AuthedRequest, res, next) => {
    try {
      await changePassword({
        userId: req.user!.id,
        currentPassword: req.body.currentPassword,
        newPassword: req.body.newPassword,
        ip: ipOf(req),
      });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);
