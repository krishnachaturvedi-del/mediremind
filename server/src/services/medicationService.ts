import { prisma } from "../db.js";
import { notFound } from "../lib/errors.js";
import { audit } from "../lib/audit.js";
import { ensureRefillAlert } from "./refillService.js";
import { medicationSchema } from "../validation.js";

export type MedicationInput = {
  name: string;
  doseAmount: number;
  doseUnit: string;
  quantityPerDose?: number;
  quantityUnit: string;
  frequency: string;
  times: string[];
  currentQuantity: number;
  refillThreshold: number;
  startDate: string;
  endDate?: string | null;
  chemistShopId?: string | null;
  status?: "ACTIVE" | "PAUSED" | "ENDED";
};

function toData(input: MedicationInput) {
  return {
    name: input.name,
    doseAmount: input.doseAmount,
    doseUnit: input.doseUnit,
    quantityPerDose: input.quantityPerDose ?? 1,
    quantityUnit: input.quantityUnit,
    frequency: input.frequency,
    times: JSON.stringify([...input.times].sort()),
    currentQuantity: input.currentQuantity,
    refillThreshold: input.refillThreshold,
    startDate: new Date(input.startDate),
    endDate: input.endDate ? new Date(input.endDate) : null,
    chemistShopId: input.chemistShopId ?? null,
    ...(input.status ? { status: input.status } : {}),
  };
}

export async function createMedication(userId: string, input: MedicationInput, ip?: string) {
  const med = await prisma.$transaction(async (tx) => {
    if (input.chemistShopId) {
      const shop = await tx.chemistShop.findUnique({ where: { id: input.chemistShopId } });
      if (!shop) throw notFound("Selected chemist shop not found.");
    }
    const created = await tx.medication.create({ data: { ...toData(input), userId } });
    if (created.currentQuantity <= created.refillThreshold) {
      await ensureRefillAlert(tx, created.id);
    }
    return created;
  });
  await audit({ userId, action: "medication.created", entity: "Medication", entityId: med.id, ip });
  return med;
}

export async function listMedications(userId: string, opts: { search?: string; status?: string } = {}) {
  const search = opts.search?.trim();
  return prisma.medication.findMany({
    where: {
      userId,
      ...(opts.status && opts.status !== "ALL" ? { status: opts.status } : {}),
      ...(search
        ? { name: { contains: search } }
        : {}),
    },
    include: { chemistShop: { select: { id: true, name: true } } },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getMedication(userId: string, id: string) {
  const med = await prisma.medication.findFirst({
    where: { id, userId },
    include: {
      chemistShop: { select: { id: true, name: true, phone: true, address: true } },
      refillAlerts: { where: { status: "OPEN" }, take: 1 },
    },
  });
  if (!med) throw notFound("Medication not found.");
  return med;
}

export async function updateMedication(
  userId: string,
  id: string,
  input: Partial<MedicationInput>,
  ip?: string
) {
  const existing = await prisma.medication.findFirst({ where: { id, userId } });
  if (!existing) throw notFound("Medication not found.");

  // Merge with existing values so partial updates validate as a whole.
  const merged: MedicationInput = {
    name: input.name ?? existing.name,
    doseAmount: input.doseAmount ?? existing.doseAmount,
    doseUnit: input.doseUnit ?? existing.doseUnit,
    quantityPerDose: input.quantityPerDose ?? existing.quantityPerDose,
    quantityUnit: input.quantityUnit ?? existing.quantityUnit,
    frequency: input.frequency ?? existing.frequency,
    times: input.times ?? JSON.parse(existing.times),
    currentQuantity: input.currentQuantity ?? existing.currentQuantity,
    refillThreshold: input.refillThreshold ?? existing.refillThreshold,
    startDate: input.startDate
      ? input.startDate
      : existing.startDate.toISOString().slice(0, 10),
    endDate:
      input.endDate !== undefined
        ? input.endDate
        : existing.endDate
          ? existing.endDate.toISOString().slice(0, 10)
          : null,
    chemistShopId:
      input.chemistShopId !== undefined ? input.chemistShopId : existing.chemistShopId,
    status: (input.status as "ACTIVE" | "PAUSED" | "ENDED") ?? (existing.status as "ACTIVE" | "PAUSED" | "ENDED"),
  };

  // Re-validate the merged result so cross-field rules always hold on updates.
  const parsed = medicationSchema.parse(merged);

  const med = await prisma.$transaction(async (tx) => {
    const updated = await tx.medication.update({ where: { id }, data: toData(parsed) });
    if (updated.currentQuantity <= updated.refillThreshold) {
      await ensureRefillAlert(tx, id);
    }
    return updated;
  });
  await audit({ userId, action: "medication.updated", entity: "Medication", entityId: id, ip });
  return med;
}

/** Pause / resume / end (soft delete). */
export async function setMedicationStatus(
  userId: string,
  id: string,
  status: "ACTIVE" | "PAUSED" | "ENDED",
  ip?: string
) {
  const existing = await prisma.medication.findFirst({ where: { id, userId } });
  if (!existing) throw notFound("Medication not found.");
  const med = await prisma.medication.update({ where: { id }, data: { status } });
  await audit({ userId, action: `medication.${status.toLowerCase()}`, entity: "Medication", entityId: id, ip });
  return med;
}

/** Estimated days of supply left based on the daily scheduled consumption. */
export function estimatedDaysLeft(med: {
  currentQuantity: number;
  quantityPerDose: number;
  times: string;
}): number | null {
  try {
    const times = JSON.parse(med.times);
    if (!Array.isArray(times) || times.length === 0) return null;
    const dailyUse = times.length * med.quantityPerDose;
    if (dailyUse <= 0) return null;
    return Math.floor((med.currentQuantity / dailyUse) * 10) / 10;
  } catch {
    return null;
  }
}

export function inventoryStatus(med: { currentQuantity: number; refillThreshold: number }): "IN_STOCK" | "LOW_STOCK" | "REFILL_REQUIRED" {
  if (med.currentQuantity <= 0) return "REFILL_REQUIRED";
  if (med.currentQuantity <= med.refillThreshold) return "REFILL_REQUIRED";
  // Low stock = within 50% of the threshold above the threshold line.
  if (med.currentQuantity <= med.refillThreshold * 1.5) return "LOW_STOCK";
  return "IN_STOCK";
}
