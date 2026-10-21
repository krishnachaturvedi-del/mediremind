import { prisma } from "../db.js";

/**
 * Lightweight audit trail for important security-relevant events.
 * Never throws into the request path — audit failures are logged only.
 */
export async function audit(opts: {
  userId?: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  details?: string;
  ip?: string;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: opts.userId ?? null,
        action: opts.action,
        entity: opts.entity,
        entityId: opts.entityId,
        details: opts.details,
        ip: opts.ip,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[audit] failed to write audit log", err);
  }
}

export function log(level: "info" | "warn" | "error", msg: string, extra?: unknown): void {
  const line = `[${new Date().toISOString()}] [${level}] ${msg}`;
  if (level === "error") console.error(line, extra ?? "");
  else if (level === "warn") console.warn(line, extra ?? "");
  else console.log(line, extra ?? "");
}
