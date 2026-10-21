import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../db.js";
import { badRequest, conflict, notFound } from "../lib/errors.js";
import { notify } from "./notificationService.js";
import { audit } from "../lib/audit.js";

type Tx = Prisma.TransactionClient | PrismaClient;

const ACTIVE_REQUEST_STATUSES = ["PENDING", "ACCEPTED", "READY"];

/**
 * Raise a refill alert (and an automatic refill request when the patient has a
 * linked chemist) when quantity drops to/below the threshold. Called inside
 * the dose-transaction so alerts and inventory stay consistent.
 * Guarantees at most ONE open alert and ONE active request per medication.
 */
export async function ensureRefillAlert(tx: Tx, medicationId: string) {
  const med = await tx.medication.findUnique({
    where: { id: medicationId },
    include: { user: { select: { id: true, name: true } } },
  });
  if (!med) return null;
  if (med.currentQuantity > med.refillThreshold) return null;

  const openAlert = await tx.refillAlert.findFirst({
    where: { medicationId, status: "OPEN" },
  });
  if (openAlert) return openAlert;

  // Patient's active chemist shop (explicit medication link, else profile link).
  let shopId = med.chemistShopId;
  if (!shopId) {
    const link = await tx.patientChemist.findFirst({
      where: { patientId: med.userId, status: "ACTIVE" },
    });
    shopId = link?.chemistShopId ?? null;
  }

  let request = null;
  if (shopId) {
    const active = await tx.refillRequest.findFirst({
      where: { medicationId, status: { in: ACTIVE_REQUEST_STATUSES } },
    });
    if (!active) {
      request = await tx.refillRequest.create({
        data: {
          medicationId,
          userId: med.userId,
          chemistShopId: shopId,
          origin: "AUTO",
          status: "PENDING",
        },
      });
    }
  }

  const alert = await tx.refillAlert.create({
    data: {
      medicationId,
      userId: med.userId,
      quantityAtTrigger: med.currentQuantity,
      threshold: med.refillThreshold,
      requestId: request?.id,
    },
  });

  await notify({
    userId: med.userId,
    type: "REFILL_ALERT",
    title: `Low stock: ${med.name}`,
    body: `${med.name} is down to ${med.currentQuantity} ${med.quantityUnit} (threshold ${med.refillThreshold}). ${
      request ? "A refill request has been sent to your chemist." : "Request a refill to avoid running out."
    }`,
    link: "/app/refills",
  }, tx);

  if (shopId) {
    const shop = await tx.chemistShop.findUnique({ where: { id: shopId } });
    if (shop) {
      await notify({
        userId: shop.ownerId,
        type: "REFILL_ALERT",
        title: `Refill needed: ${med.name}`,
        body: `Patient ${med.user.name} is running low on ${med.name} (${med.currentQuantity} ${med.quantityUnit} remaining).`,
        link: "/chemist",
      }, tx);
    }
  }
  return alert;
}

/** Resolve open alerts for a medication once stock is healthy again. */
export async function resolveAlertsIfStockHealthy(tx: Tx, medicationId: string) {
  const med = await tx.medication.findUnique({ where: { id: medicationId } });
  if (!med || med.currentQuantity <= med.refillThreshold) return;
  await tx.refillAlert.updateMany({
    where: { medicationId, status: "OPEN" },
    data: { status: "RESOLVED", resolvedAt: new Date() },
  });
}

// ------------------------------------------------------------ patient side

export async function listPatientRefills(userId: string) {
  const [requests, alerts] = await Promise.all([
    prisma.refillRequest.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        medication: { select: { name: true, quantityUnit: true, currentQuantity: true, refillThreshold: true } },
        chemistShop: { select: { name: true, address: true, phone: true } },
        transactions: true,
      },
    }),
    prisma.refillAlert.findMany({
      where: { userId },
      orderBy: { triggeredAt: "desc" },
      take: 50,
      include: { medication: { select: { name: true, quantityUnit: true } } },
    }),
  ]);
  return { requests, alerts };
}

export async function createPatientRefillRequest(
  userId: string,
  input: { medicationId: string; quantityRequested?: number; patientNote?: string }
) {
  const med = await prisma.medication.findFirst({
    where: { id: input.medicationId, userId },
  });
  if (!med) throw notFound("Medication not found.");

  let shopId = med.chemistShopId;
  if (!shopId) {
    const link = await prisma.patientChemist.findFirst({
      where: { patientId: userId, status: "ACTIVE" },
    });
    shopId = link?.chemistShopId ?? null;
  }
  if (!shopId) {
    throw badRequest(
      "No chemist is linked to your account yet. Link a chemist shop first.",
      "NO_CHEMIST"
    );
  }

  const active = await prisma.refillRequest.findFirst({
    where: { medicationId: med.id, status: { in: ACTIVE_REQUEST_STATUSES } },
  });
  if (active) {
    throw conflict(
      "There is already an active refill request for this medication.",
      "ACTIVE_REQUEST_EXISTS"
    );
  }

  const request = await prisma.$transaction(async (tx) => {
    const created = await tx.refillRequest.create({
      data: {
        medicationId: med.id,
        userId,
        chemistShopId: shopId!,
        quantityRequested: input.quantityRequested,
        patientNote: input.patientNote,
        origin: "MANUAL",
      },
    });
    const shop = await tx.chemistShop.findUnique({ where: { id: shopId! } });
    if (shop) {
      await notify({
        userId: shop.ownerId,
        type: "REFILL_UPDATE",
        title: `Refill request: ${med.name}`,
        body: `A patient has requested a refill of ${med.name}.`,
        link: "/chemist",
      }, tx);
    }
    return created;
  });
  await audit({ userId, action: "refill.requested", entity: "RefillRequest", entityId: request.id });
  return request;
}

export async function cancelPatientRefillRequest(userId: string, id: string) {
  const request = await prisma.refillRequest.findFirst({ where: { id, userId } });
  if (!request) throw notFound("Refill request not found.");
  if (!["PENDING", "ACCEPTED"].includes(request.status)) {
    throw conflict(`A ${request.status.toLowerCase()} request cannot be cancelled.`);
  }
  const updated = await prisma.refillRequest.update({
    where: { id },
    data: { status: "CANCELLED" },
  });
  await prisma.refillAlert.updateMany({
    where: { requestId: id, status: "OPEN" },
    data: { requestId: null },
  });
  await audit({ userId, action: "refill.cancelled", entity: "RefillRequest", entityId: id });
  return updated;
}

// ----------------------------------------------------------- chemist side

export async function chemistShopOf(chemistUserId: string) {
  const shop = await prisma.chemistShop.findUnique({
    where: { ownerId: chemistUserId },
  });
  if (!shop) throw notFound("No registered chemist shop is linked to this account.");
  return shop;
}

export async function listChemistRefills(chemistUserId: string, status?: string) {
  const shop = await chemistShopOf(chemistUserId);
  return prisma.refillRequest.findMany({
    where: {
      chemistShopId: shop.id,
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      medication: { select: { name: true, doseAmount: true, doseUnit: true, quantityUnit: true, currentQuantity: true } },
      user: { select: { id: true, name: true, phone: true } },
      transactions: true,
      alert: { select: { id: true, status: true } },
    },
  });
}

export async function listChemistTransactions(chemistUserId: string) {
  const shop = await chemistShopOf(chemistUserId);
  return prisma.refillTransaction.findMany({
    where: { medication: { chemistShopId: shop.id }, chemistUserId },
    orderBy: { confirmedAt: "desc" },
    take: 200,
    include: {
      medication: { select: { name: true, quantityUnit: true } },
      refillRequest: { select: { id: true, user: { select: { name: true } } } },
    },
  });
}

export async function chemistActOnRefill(
  chemistUserId: string,
  requestId: string,
  action: "ACCEPT" | "REJECT" | "READY" | "COMPLETE" | "CANCEL",
  opts: { quantitySupplied?: number; rejectReason?: string; ip?: string } = {}
) {
  const shop = await chemistShopOf(chemistUserId);
  // Ownership check: requests of unrelated patients are invisible (404).
  const request = await prisma.refillRequest.findFirst({
    where: { id: requestId, chemistShopId: shop.id },
    include: { medication: true, user: { select: { id: true, name: true } } },
  });
  if (!request) throw notFound("Refill request not found.");

  const statusFlow: Record<string, string[]> = {
    ACCEPT: ["PENDING"],
    REJECT: ["PENDING", "ACCEPTED"],
    READY: ["ACCEPTED"],
    COMPLETE: ["ACCEPTED", "READY"],
    // A chemist may withdraw a request the patient raised but no longer needs,
    // only before any stock has been supplied.
    CANCEL: ["PENDING", "ACCEPTED"],
  };
  if (!statusFlow[action].includes(request.status)) {
    // Specific code for re-confirming an already completed refill.
    if (action === "COMPLETE" && request.status === "COMPLETED") {
      throw conflict("This refill was already processed.", "ALREADY_PROCESSED");
    }
    throw conflict(
      `Cannot ${action.toLowerCase()} a request with status ${request.status}.`,
      "INVALID_STATUS_TRANSITION"
    );
  }

  if (action === "COMPLETE") {
    if (!opts.quantitySupplied || opts.quantitySupplied <= 0) {
      throw badRequest("Enter the quantity supplied to complete this refill.");
    }
    const supplied = opts.quantitySupplied;
    // Transaction + DB-level unique constraint on refillRequestId make
    // double-confirmation impossible even under concurrent requests.
    const result = await prisma.$transaction(async (tx) => {
      const guard = await tx.refillRequest.updateMany({
        where: { id: requestId, status: { in: ["ACCEPTED", "READY"] } },
        data: { status: "COMPLETED" },
      });
      if (guard.count === 0) {
        throw conflict("This refill was already processed.", "ALREADY_PROCESSED");
      }
      const txn = await tx.refillTransaction.create({
        data: {
          refillRequestId: requestId,
          medicationId: request.medicationId,
          quantitySupplied: supplied,
          chemistUserId,
        },
      });
      await tx.medication.update({
        where: { id: request.medicationId },
        data: { currentQuantity: { increment: supplied } },
      });
      const updatedMed = await tx.medication.findUnique({
        where: { id: request.medicationId },
      });
      if (updatedMed && updatedMed.currentQuantity > updatedMed.refillThreshold) {
        await tx.refillAlert.updateMany({
          where: { medicationId: request.medicationId, status: "OPEN" },
          data: { status: "RESOLVED", resolvedAt: new Date() },
        });
      }
      return txn;
    });
    await notify({
      userId: request.userId,
      type: "REFILL_UPDATE",
      title: `Refill ready: ${request.medication.name}`,
      body: `Your chemist ${shop.name} supplied ${supplied} ${request.medication.quantityUnit} of ${request.medication.name}.`,
      link: "/app/refills",
    });
    await audit({
      userId: chemistUserId,
      action: "refill.completed",
      entity: "RefillRequest",
      entityId: requestId,
      details: `supplied=${supplied}`,
      ip: opts.ip,
    });
    return { request, transaction: result };
  }

  const newStatus =
    action === "ACCEPT"
      ? "ACCEPTED"
      : action === "READY"
        ? "READY"
        : action === "CANCEL"
          ? "CANCELLED"
          : "REJECTED";
  const updated = await prisma.refillRequest.update({
    where: { id: requestId },
    data: {
      status: newStatus,
      ...(action === "REJECT" ? { rejectReason: opts.rejectReason ?? "No reason provided" } : {}),
    },
  });
  if (action === "CANCEL") {
    // Release the linked alert so it can be re-raised if stock stays low.
    await prisma.refillAlert.updateMany({
      where: { requestId, status: "OPEN" },
      data: { requestId: null },
    });
  }
  await notify({
    userId: request.userId,
    type: "REFILL_UPDATE",
    title: `Refill ${newStatus.toLowerCase()}: ${request.medication.name}`,
    body:
      action === "REJECT"
        ? `${shop.name} could not fulfil your ${request.medication.name} refill: ${opts.rejectReason ?? "no reason provided"}.`
        : action === "CANCEL"
          ? `${shop.name} cancelled your ${request.medication.name} refill. You can raise a new request when you need one.`
          : `${shop.name} marked your ${request.medication.name} refill as ${newStatus.toLowerCase()}.`,
    link: "/app/refills",
  });
  await audit({
    userId: chemistUserId,
    action: `refill.${action.toLowerCase()}`,
    entity: "RefillRequest",
    entityId: requestId,
    ip: opts.ip,
  });
  return { request: updated, transaction: null };
}

/** Patient–chemist linking. */
export async function listChemistShops() {
  return prisma.chemistShop.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, address: true, phone: true, licenseNumber: true },
  });
}

export async function linkPatientChemist(patientId: string, shopId: string) {
  const shop = await prisma.chemistShop.findUnique({ where: { id: shopId } });
  if (!shop) throw notFound("Chemist shop not found.");
  const link = await prisma.patientChemist.upsert({
    where: { patientId },
    create: { patientId, chemistShopId: shopId, status: "ACTIVE" },
    update: { chemistShopId: shopId, status: "ACTIVE" },
  });
  await audit({ userId: patientId, action: "chemist.linked", entity: "PatientChemist", entityId: link.id });
  return { link, shop };
}

export async function unlinkPatientChemist(patientId: string) {
  const existing = await prisma.patientChemist.findUnique({ where: { patientId } });
  if (!existing) throw notFound("No chemist is linked to your account.");
  const link = await prisma.patientChemist.update({
    where: { patientId },
    data: { status: "REVOKED" },
  });
  await audit({ userId: patientId, action: "chemist.unlinked", entity: "PatientChemist", entityId: link.id });
  return link;
}

export async function getPatientChemist(patientId: string) {
  return prisma.patientChemist.findUnique({
    where: { patientId },
    include: {
      chemistShop: {
        select: { id: true, name: true, address: true, phone: true, licenseNumber: true },
      },
    },
  });
}
