// Generates prisma/schema.postgres.prisma from prisma/schema.prisma by swapping
// only the datasource provider line, so the two schemas cannot drift apart.
//
// Plain Node (no TypeScript, no dependencies) on purpose: this runs during the
// production build, where devDependencies such as tsx are not installed.
//
// Usage (from server/): npm run db:use:postgres
const fs = require("node:fs");
const path = require("node:path");

const prismaDir = path.resolve(__dirname, "../prisma");
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
