import express from "express";
import session from "express-session";
import Memorystore from "memorystore";
import connectPgSimple from "connect-pg-simple";
import cors from "cors";
import { config } from "./config.js";
import { loadUser } from "./middleware/auth.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { apiLimiter, securityHeaders } from "./middleware/rateLimit.js";
import { authRouter } from "./routes/auth.js";
import { medicationsRouter } from "./routes/medications.js";
import { dosesRouter } from "./routes/doses.js";
import { inventoryRouter } from "./routes/inventory.js";
import { refillsRouter, chemistRouter } from "./routes/refills.js";
import { caregiverRouter, shopsRouter } from "./routes/caregiver.js";
import { reportsRouter } from "./routes/reports.js";
import {
  notificationsRouter,
  dashboardRouter,
  profileRouter,
} from "./routes/misc.js";

const MemoryStore = Memorystore(session);
const PgSession = connectPgSimple(session);

/**
 * Session store selection.
 *
 * - Test / development: memorystore, an in-process store. It does not survive
 *   restarts and does not share state across processes, which is fine locally.
 * - Production: a PostgreSQL-backed store so sessions survive restarts and work
 *   across multiple server instances. Requires DATABASE_URL (the same Postgres
 *   database Prisma uses).
 */
function createSessionStore(): session.Store {
  if (config.isProduction) {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL is required in production to configure the PostgreSQL session store."
      );
    }
    return new PgSession({
      conString: process.env.DATABASE_URL,
      tableName: "user_sessions",
      createTableIfMissing: true,
      pruneSessionInterval: 60 * 15, // seconds
    });
  }
  return new MemoryStore({ checkPeriod: 1000 * 60 * 60 * 24 });
}

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(securityHeaders);
  app.use(
    cors({
      origin: config.corsOrigins,
      credentials: true,
    })
  );
  app.use(express.json({ limit: "200kb" }));

  app.use(
    session({
      name: "mediremind.sid",
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        // Cross-site cookies (client and API on different domains) require
        // sameSite "none", which browsers only accept together with secure.
        // Same-origin deployments keep "lax". Override with COOKIE_SAME_SITE.
        sameSite: (process.env.COOKIE_SAME_SITE as "lax" | "strict" | "none" | undefined) ??
          (config.isProduction ? "none" : "lax"),
        secure: config.isProduction,
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      },
      // Development/test use memorystore; production uses a PostgreSQL-backed
      // store (see createSessionStore above) so sessions survive restarts and
      // are shared across instances.
      store: createSessionStore(),
    })
  );
  app.use(loadUser);
  app.use("/api", apiLimiter);

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/medications", medicationsRouter);
  app.use("/api/doses", dosesRouter);
  app.use("/api/inventory", inventoryRouter);
  app.use("/api/refills", refillsRouter);
  app.use("/api/chemist", chemistRouter);
  app.use("/api/caregiver", caregiverRouter);
  app.use("/api/shops", shopsRouter);
  app.use("/api/reports", reportsRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/profile", profileRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
