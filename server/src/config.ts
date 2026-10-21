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
