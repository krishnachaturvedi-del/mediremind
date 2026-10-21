import type { Request, Response, NextFunction } from "express";
import { prisma } from "../db.js";
import { forbidden, unauthorized } from "../lib/errors.js";
import type { User } from "@prisma/client";

export type AuthedRequest = Request & { user?: User };

/**
 * Loads the session user for every request that passes through this middleware.
 * Requires an authenticated session (enforced by `requireAuth` when placed after it).
 */
export async function loadUser(
  req: AuthedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.session?.userId;
    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) req.user = user;
      else delete req.session.userId; // session refers to deleted user
    }
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAuth(
  req: AuthedRequest,
  _res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    next(unauthorized());
    return;
  }
  next();
}

export function requireRole(...roles: string[]) {
  return (req: AuthedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(unauthorized());
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(forbidden("Your account type does not have access to this resource."));
      return;
    }
    next();
  };
}
