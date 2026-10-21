/**
 * Controlled chemist provisioning — chemist accounts CANNOT be created through
 * public registration. An administrator runs this script (or performs the
 * equivalent out-of-band process) to create the chemist user and their shop.
 *
 * Usage:
 *   npm run provision:chemist -w server -- \
 *     --email pharmacy@example.com --password "Str0ngPass!" \
 *     --name "Pharmacy Owner" --shop "WellLife Pharmacy" \
 *     --license "MH-PH-2024-0001" --address "12 Main St" --phone "+91 22 4000 1000"
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function arg(name: string, fallback?: string): string {
  const idx = process.argv.indexOf(`--${name}`);
  const val = idx >= 0 ? process.argv[idx + 1] : fallback;
  if (!val) {
    console.error(`Missing required argument --${name}`);
    process.exit(1);
  }
  return val;
}

async function main() {
  const email = arg("email").toLowerCase();
  const password = arg("password");
  const name = arg("name");
  const shopName = arg("shop");
  const license = arg("license");
  const address = arg("address");
  const phone = arg("phone");

  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.error(`A user with email ${email} already exists.`);
    process.exit(1);
  }

  const user = await prisma.user.create({
    data: {
      email,
      name,
      role: "CHEMIST",
      passwordHash: await bcrypt.hash(password, 12),
      phone,
    },
  });
  await prisma.chemistShop.create({
    data: {
      name: shopName,
      licenseNumber: license,
      address,
      phone,
      ownerId: user.id,
    },
  });
  console.log(`Chemist provisioned: ${email} (shop: ${shopName})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
