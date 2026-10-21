import { execSync } from "node:child_process";
import path from "node:path";

/**
 * Reset the SQLite test database once before the whole test run.
 * The database file lives next to the schema (server/prisma/test.db).
 */
export default function globalSetup(): void {
  process.env.DATABASE_URL = "file:./test.db";
  const schema = path.resolve(__dirname, "../prisma/schema.prisma");
  execSync(`npx prisma db push --force-reset --skip-generate --schema "${schema}"`, {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
  });
}
