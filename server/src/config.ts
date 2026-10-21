import "dotenv/config";

function required(name: string, fallback: string): string {
  const v = process.env[name];
  if (v && v.trim() !== "") return v;
  return fallback;
}

export const config = {
  port: Number(required("PORT", "3001")),
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProduction: process.env.NODE_ENV === "production",
  isTest: process.env.NODE_ENV === "test",
  sessionSecret: required(
    "SESSION_SECRET",
    "dev-only-insecure-secret-change-me-before-production-0123456789"
  ),
  corsOrigins: required("CORS_ORIGIN", "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  rateLimit: {
    windowMs: Number(required("RATE_LIMIT_WINDOW_MS", "900000")),
    max: Number(required("RATE_LIMIT_MAX", "300")),
    authMax: Number(required("AUTH_RATE_LIMIT_MAX", "20")),
  },
};

const DEV_SESSION_SECRET =
  "dev-only-insecure-secret-change-me-before-production-0123456789";

/**
 * Fail fast on production misconfiguration.
 *
 * A checked-in `.env` (or any local .env) can silently supply development values
 * in a production process, which would leave the app on SQLite and in-memory
 * sessions. Validate explicitly rather than degrading quietly.
 */
function assertProductionConfig(): void {
  if (!config.isProduction) return;

  const problems: string[] = [];

  if (!process.env.DATABASE_URL) {
    problems.push("DATABASE_URL is required (PostgreSQL connection string).");
  } else if (!/^postgres(ql)?:\/\//.test(process.env.DATABASE_URL)) {
    problems.push(
      `DATABASE_URL must be a PostgreSQL URL in production (got "${process.env.DATABASE_URL.split(":")[0]}:..."). SQLite is not supported in production.`
    );
  }

  if (!process.env.SESSION_SECRET || config.sessionSecret === DEV_SESSION_SECRET) {
    problems.push("SESSION_SECRET must be set to a strong, unique value.");
  }

  if (problems.length > 0) {
    throw new Error(
      `Invalid production configuration:\n  - ${problems.join("\n  - ")}`
    );
  }
}

assertProductionConfig();
