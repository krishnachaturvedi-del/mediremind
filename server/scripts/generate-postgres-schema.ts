// Generates prisma/schema.postgres.prisma from prisma/schema.prisma by swapping
// only the datasource provider line, so the two schemas cannot drift apart.
//
// Usage (from server/): npm run db:use:postgres
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const prismaDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../prisma");
const src = path.join(prismaDir, "schema.prisma");
const dest = path.join(prismaDir, "schema.postgres.prisma");

const sqlite = fs.readFileSync(src, "utf8");
const marker = 'provider = "sqlite" // production: "postgresql"';

if (!sqlite.includes(marker)) {
  console.error(
    `ERROR: expected the datasource provider line in ${src} to read exactly:\n  ${marker}`
  );
  process.exit(1);
}

const header = [
  "// GENERATED FROM schema.prisma -- do not edit by hand.",
  "// Edit schema.prisma, then run: npm run db:use:postgres",
  "//",
  "",
].join("\n");

fs.writeFileSync(dest, header + sqlite.replace(marker, 'provider = "postgresql"'), "utf8");
console.log(`Generated ${path.relative(process.cwd(), dest)}`);
