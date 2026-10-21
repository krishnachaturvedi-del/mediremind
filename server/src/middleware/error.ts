import type { Request, Response, NextFunction } from "express";
import { ZodError, type ZodSchema } from "zod";
import { ApiError } from "../lib/errors.js";
import { config } from "../config.js";
import { log } from "../lib/audit.js";

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

/** Validate req.body with the given Zod schema, replacing it with parsed data. */
export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body ?? {});
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Central error handler. Produces safe messages; logs details server-side. */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Please check the submitted values.",
        issues: err.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
    });
    return;
  }
  log("error", "Unhandled error", err);
  // Never expose internal error details to clients.
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: config.isProduction
        ? "Something went wrong. Please try again."
        : `Something went wrong: ${(err as Error)?.message ?? err}`,
    },
  });
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Endpoint not found." } });
}
