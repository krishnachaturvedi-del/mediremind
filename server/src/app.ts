import express from "express";
import session from "express-session";
import Memorystore from "memorystore";
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
        sameSite: "lax",
        secure: config.isProduction,
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      },
      // NOTE: memorystore is an in-memory development store. It does not
      // survive restarts and does not share state across processes. For
      // production use a persistent shared store (e.g. connect-redis or a
      // database-backed session store).
      store: new MemoryStore({ checkPeriod: 1000 * 60 * 60 * 24 }),
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
