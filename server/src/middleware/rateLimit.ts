import type { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { config } from "../config.js";

/** General API limiter. */
export const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: "RATE_LIMITED",
      message: "Too many requests. Please slow down and try again shortly.",
    },
  },
});

/** Stricter limiter for authentication endpoints (login/register/password). */
export const authLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: "RATE_LIMITED",
      message: "Too many authentication attempts. Please try again later.",
    },
  },
});

/** Security headers that do not require extra dependencies. */
export function securityHeaders(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
}
