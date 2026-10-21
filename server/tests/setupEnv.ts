// Runs before each test file (Vitest setupFiles).
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "file:./test.db";
process.env.SESSION_SECRET = "test-secret-key-for-vitest-only-0123456789";
// Raise rate limits so the suite is not throttled by the auth limiter.
process.env.AUTH_RATE_LIMIT_MAX = "100000";
process.env.RATE_LIMIT_MAX = "100000";
process.env.RATE_LIMIT_WINDOW_MS = "60000";
