/**
 * Development seed data — ALL information is fictional.
 * Run: npm run db:seed -w server
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { dateKeyOf, scheduledAtFor, shiftDateKey } from "../src/lib/time.js";

const prisma = new PrismaClient();

function daysAgo(n: number): string {
  return shiftDateKey(dateKeyOf(new Date()), -n);
}

async function main() {
  console.log("Seeding MediRemind development database (fictional data)...");

  // Clear existing seed data (dev only).
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.refillTransaction.deleteMany(),
    prisma.refillAlert.deleteMany(),
    prisma.refillRequest.deleteMany(),
    prisma.doseLog.deleteMany(),
    prisma.caregiverLink.deleteMany(),
    prisma.patientChemist.deleteMany(),
    prisma.medication.deleteMany(),
    prisma.chemistShop.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  const hash = (pw: string) => bcrypt.hash(pw, 12);

  // --- users ---------------------------------------------------------------
  const alice = await prisma.user.create({
    data: {
      email: "alice.patient@mediremind.dev",
      name: "Alice Fernandes",
      passwordHash: await hash("Password123!"),
      role: "PATIENT",
      phone: "+91 90000 10001",
    },
  });
  const bob = await prisma.user.create({
    data: {
      email: "bob.patient@mediremind.dev",
      name: "Bob Kessler",
      passwordHash: await hash("Password123!"),
      role: "PATIENT",
      phone: "+91 90000 10002",
    },
  });
  const chemist = await prisma.user.create({
    data: {
      email: "ravi.chemist@mediremind.dev",
      name: "Ravi Chandran",
      passwordHash: await hash("Chemist123!"),
      role: "CHEMIST",
      phone: "+91 90000 20001",
    },
  });
  const caregiver = await prisma.user.create({
    data: {
      email: "son.caregiver@mediremind.dev",
      name: "Marcus Fernandes",
      passwordHash: await hash("Caregiver123!"),
      role: "CAREGIVER",
      phone: "+91 90000 30001",
    },
  });

  // --- chemist shop + patient links ----------------------------------------
  const shop = await prisma.chemistShop.create({
    data: {
      name: "WellLife Pharmacy",
      licenseNumber: "MH-PH-2024-0451",
      address: "12 Link Road, Bandra West, Mumbai 400050",
      phone: "+91 22 4000 1000",
      ownerId: chemist.id,
    },
  });
  await prisma.patientChemist.create({
    data: { patientId: alice.id, chemistShopId: shop.id, status: "ACTIVE" },
  });
  await prisma.patientChemist.create({
    data: { patientId: bob.id, chemistShopId: shop.id, status: "ACTIVE" },
  });

  // --- caregiver consent link (active) --------------------------------------
  await prisma.caregiverLink.create({
    data: {
      patientId: alice.id,
      caregiverId: caregiver.id,
      status: "ACTIVE",
      invitedByEmail: caregiver.email,
      shareAdherence: true,
      shareMissed: true,
      shareUpcoming: true,
      shareRefills: true,
      shareInventory: false,
    },
  });

  // --- medications ----------------------------------------------------------
  const today = dateKeyOf(new Date());
  const metformin = await prisma.medication.create({
    data: {
      userId: alice.id,
      name: "Metformin 500",
      doseAmount: 500,
      doseUnit: "mg",
      quantityPerDose: 1,
      quantityUnit: "tablets",
      frequency: "TWICE_DAILY",
      times: JSON.stringify(["08:00", "20:00"]),
      currentQuantity: 24,
      refillThreshold: 8,
      startDate: new Date(daysAgo(30) + "T00:00:00"),
      chemistShopId: shop.id,
      status: "ACTIVE",
    },
  });
  const amlodipine = await prisma.medication.create({
    data: {
      userId: alice.id,
      name: "Amlodipine 5",
      doseAmount: 5,
      doseUnit: "mg",
      quantityPerDose: 1,
      quantityUnit: "tablets",
      frequency: "ONCE_DAILY",
      times: JSON.stringify(["09:00"]),
      currentQuantity: 6, // low stock demo
      refillThreshold: 7,
      startDate: new Date(daysAgo(20) + "T00:00:00"),
      chemistShopId: shop.id,
      status: "ACTIVE",
    },
  });
  await prisma.medication.create({
    data: {
      userId: alice.id,
      name: "Atorvastatin 10",
      doseAmount: 10,
      doseUnit: "mg",
      quantityPerDose: 1,
      quantityUnit: "tablets",
      frequency: "ONCE_DAILY",
      times: JSON.stringify(["21:30"]),
      currentQuantity: 30,
      refillThreshold: 6,
      startDate: new Date(daysAgo(15) + "T00:00:00"),
      status: "PAUSED", // paused med demo
    },
  });
  const bobMed = await prisma.medication.create({
    data: {
      userId: bob.id,
      name: "Losartan 50",
      doseAmount: 50,
      doseUnit: "mg",
      quantityPerDose: 1,
      quantityUnit: "tablets",
      frequency: "ONCE_DAILY",
      times: JSON.stringify(["08:30"]),
      currentQuantity: 4, // low -> triggers auto refill request
      refillThreshold: 5,
      startDate: new Date(daysAgo(25) + "T00:00:00"),
      chemistShopId: shop.id,
      status: "ACTIVE",
    },
  });

  // --- dose history for the past 10 days (reports demo) --------------------
  const meds = [metformin, amlodipine];
  const doseLogs: {
    medicationId: string; userId: string; dateKey: string; timeStr: string;
    scheduledAt: Date; status: string; actionAt: Date | null; quantityDelta: number;
  }[] = [];
  for (let d = 10; d >= 1; d--) {
    const dk = daysAgo(d);
    for (const med of meds) {
      const times: string[] = JSON.parse(med.times);
      for (const t of times) {
        const taken = (d + t.charCodeAt(1) + med.name.length) % 7 !== 0; // ~1 in 7 skipped
        doseLogs.push({
          medicationId: med.id,
          userId: med.userId,
          dateKey: dk,
          timeStr: t,
          scheduledAt: scheduledAtFor(dk, t),
          status: taken ? "TAKEN" : "SKIPPED",
          actionAt: taken ? new Date(scheduledAtFor(dk, t).getTime() + 4 * 60000) : new Date(scheduledAtFor(dk, t).getTime() + 20 * 60000),
          quantityDelta: taken ? -med.quantityPerDose : 0,
        });
      }
    }
  }
  // Bob's history: mostly taken.
  {
    const times: string[] = JSON.parse(bobMed.times);
    for (let d = 8; d >= 1; d--) {
      const dk = daysAgo(d);
      for (const t of times) {
        doseLogs.push({
          medicationId: bobMed.id,
          userId: bob.id,
          dateKey: dk,
          timeStr: t,
          scheduledAt: scheduledAtFor(dk, t),
          status: "TAKEN",
          actionAt: new Date(scheduledAtFor(dk, t).getTime() + 6 * 60000),
          quantityDelta: -bobMed.quantityPerDose,
        });
      }
    }
  }
  await prisma.doseLog.createMany({ data: doseLogs });

  // --- auto refill alert/request for the low-stock meds --------------------
  const { ensureRefillAlert } = await import("../src/services/refillService.js");
  await ensureRefillAlert(prisma, amlodipine.id);
  await ensureRefillAlert(prisma, bobMed.id);

  // --- today's pending doses (so the dashboard has a live schedule) --------
  const { materializeDosesForAllUsers } = await import("../src/services/scheduleService.js");
  await materializeDosesForAllUsers(today);
  // Yesterday's unresolved pending doses -> shows as MISSED in reports.
  await materializeDosesForAllUsers(shiftDateKey(today, -1));

  // --- notifications --------------------------------------------------------
  await prisma.notification.createMany({
    data: [
      {
        userId: alice.id,
        type: "REFILL_ALERT",
        title: "Low stock: Amlodipine 5",
        body: "Amlodipine 5 is down to 6 tablets (threshold 7). A refill request has been sent to your chemist.",
        link: "/app/refills",
      },
      {
        userId: chemist.id,
        type: "REFILL_ALERT",
        title: "Refill needed: Losartan 50",
        body: "Patient Bob Kessler is running low on Losartan 50 (4 tablets remaining).",
        link: "/chemist",
      },
      {
        userId: caregiver.id,
        type: "CAREGIVER",
        title: "Alice Fernandes shared her medication updates with you",
        body: "You can now view adherence, missed doses, upcoming reminders and refill status.",
        link: "/app/caregiver",
      },
    ],
  });

  console.log("\nSeed complete. Demo accounts (fictional):");
  console.log("  Patient:    alice.patient@mediremind.dev / Password123!");
  console.log("  Patient 2:  bob.patient@mediremind.dev   / Password123!");
  console.log("  Chemist:    ravi.chemist@mediremind.dev / Chemist123!");
  console.log("  Caregiver:  son.caregiver@mediremind.dev  / Caregiver123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
