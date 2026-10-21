import { prisma } from "../db.js";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors.js";
import { notify } from "./notificationService.js";
import { audit } from "../lib/audit.js";
import { todayKey, shiftDateKey } from "../lib/time.js";
import { inventoryStatus } from "./medicationService.js";

export type CaregiverScopes = {
  shareAdherence: boolean;
  shareMissed: boolean;
  shareUpcoming: boolean;
  shareRefills: boolean;
  shareInventory: boolean;
};

/**
 * Invite a caregiver by email (in-app workflow; no email service is configured
 * in this environment — the invitee sees the pending invite after registering
 * with the same email). The link only becomes usable once the caregiver
 * accepts AND the patient's consent remains ACTIVE.
 */
export async function inviteCaregiver(
  patientId: string,
  patientName: string,
  input: { email: string } & CaregiverScopes,
  ip?: string
) {
  if (input.email === undefined) throw badRequest("Caregiver email is required.");
  const caregiver = await prisma.user.findUnique({ where: { email: input.email } });
  if (!caregiver) {
    throw badRequest(
      "No MediRemind account exists with that email. Ask your caregiver to register first, then invite them again.",
      "CAREGIVER_NOT_FOUND"
    );
  }
  if (caregiver.id === patientId) {
    throw badRequest("You cannot invite yourself as a caregiver.", "SELF_INVITE");
  }
  if (caregiver.role !== "CAREGIVER") {
    throw badRequest(
      "That account is not a caregiver account. Caregivers must register as a caregiver before you can invite them.",
      "CAREGIVER_ROLE_REQUIRED"
    );
  }
  const existing = await prisma.caregiverLink.findUnique({
    where: { patientId_caregiverId: { patientId, caregiverId: caregiver.id } },
  });
  if (existing && existing.status !== "REVOKED") {
    throw conflict("A caregiver link with this person already exists.", "LINK_EXISTS");
  }

  const link = await prisma.$transaction(async (tx) => {
    const scopes = {
      shareAdherence: input.shareAdherence,
      shareMissed: input.shareMissed,
      shareUpcoming: input.shareUpcoming,
      shareRefills: input.shareRefills,
      shareInventory: input.shareInventory,
    };
    const l = existing
      ? await tx.caregiverLink.update({ where: { id: existing.id }, data: { ...scopes, status: "PENDING" } })
      : await tx.caregiverLink.create({
          data: { patientId, caregiverId: caregiver.id, invitedByEmail: input.email, ...scopes },
        });
    await tx.notification.create({
      data: {
        userId: caregiver.id,
        type: "CAREGIVER",
        title: `${patientName} invited you as a caregiver`,
        body: "Review the access request and accept to start receiving medication updates.",
        link: "/app/caregiver",
      },
    });
    return l;
  });
  await audit({ userId: patientId, action: "caregiver.invited", entity: "CaregiverLink", entityId: link.id, ip });
  return link;
}

export async function respondToCaregiverInvite(caregiverId: string, linkId: string, accept: boolean, ip?: string) {
  const link = await prisma.caregiverLink.findFirst({ where: { id: linkId, caregiverId } });
  if (!link) throw notFound("Caregiver invitation not found.");
  if (link.status !== "PENDING") {
    throw conflict(`This invitation is already ${link.status.toLowerCase()}.`);
  }
  const updated = await prisma.caregiverLink.update({
    where: { id: linkId },
    data: { status: accept ? "ACTIVE" : "REVOKED" },
  });
  if (accept) {
    await notify({
      userId: link.patientId,
      type: "CAREGIVER",
      title: "Caregiver access activated",
      body: "Your caregiver accepted the access request and can now view the shared information.",
      link: "/app/caregiver",
    });
  }
  await audit({ userId: caregiverId, action: accept ? "caregiver.accepted" : "caregiver.declined", entity: "CaregiverLink", entityId: linkId, ip });
  return updated;
}

export async function listLinksForPatient(patientId: string) {
  return prisma.caregiverLink.findMany({
    where: { patientId },
    include: { caregiver: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function listLinksForCaregiver(caregiverId: string) {
  return prisma.caregiverLink.findMany({
    where: { caregiverId },
    include: { patient: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateCaregiverScopes(patientId: string, linkId: string, scopes: CaregiverScopes) {
  const link = await prisma.caregiverLink.findFirst({ where: { id: linkId, patientId } });
  if (!link) throw notFound("Caregiver link not found.");
  if (link.status === "REVOKED") throw conflict("This link was revoked. Invite the caregiver again.");
  const updated = await prisma.caregiverLink.update({ where: { id: linkId }, data: scopes });
  await audit({ userId: patientId, action: "caregiver.scopes_updated", entity: "CaregiverLink", entityId: linkId });
  return updated;
}

export async function revokeCaregiver(patientId: string, linkId: string, ip?: string) {
  const link = await prisma.caregiverLink.findFirst({ where: { id: linkId, patientId } });
  if (!link) throw notFound("Caregiver link not found.");
  const updated = await prisma.caregiverLink.update({
    where: { id: linkId },
    data: { status: "REVOKED" },
  });
  await notify({
    userId: link.caregiverId,
    type: "CAREGIVER",
    title: "Caregiver access revoked",
    body: "The patient revoked your access to their medication information.",
    link: "/app/caregiver",
  });
  await audit({ userId: patientId, action: "caregiver.revoked", entity: "CaregiverLink", entityId: linkId, ip });
  return updated;
}

/** Load an ACTIVE link with ownership checks, or throw. */
async function activeLink(caregiverId: string, patientId: string) {
  const link = await prisma.caregiverLink.findUnique({
    where: { patientId_caregiverId: { patientId, caregiverId } },
  });
  // Revoked/absent links are indistinguishable to the caregiver.
  if (!link || link.status !== "ACTIVE") {
    throw forbidden("You do not have active consent-based access to this patient's information.");
  }
  return link;
}

/**
 * Consent-based caregiver view: every field respects the scopes the patient
 * granted, and access is denied immediately after revocation.
 */
export async function caregiverPatientSummary(caregiverId: string, patientId: string) {
  const link = await activeLink(caregiverId, patientId);
  const today = todayKey();

  const base: Record<string, unknown> = {
    patient: { id: patientId },
    scopes: {
      shareAdherence: link.shareAdherence,
      shareMissed: link.shareMissed,
      shareUpcoming: link.shareUpcoming,
      shareRefills: link.shareRefills,
      shareInventory: link.shareInventory,
    },
  };

  // 7-day adherence (past days only; future doses never count as missed).
  if (link.shareAdherence || link.shareMissed) {
    const days = Array.from({ length: 7 }, (_, i) => shiftDateKey(today, -(i + 1)));
    const logs = await prisma.doseLog.findMany({
      where: { userId: patientId, dateKey: { in: days } },
      include: { medication: { select: { name: true } } },
    });
    const taken = logs.filter((l) => l.status === "TAKEN").length;
    const skipped = logs.filter((l) => l.status === "SKIPPED").length;
    const missed = logs.filter((l) => l.status === "PENDING").length; // past days only
    const adherence = taken + skipped + missed > 0 ? Math.round((taken / (taken + skipped + missed)) * 100) : null;
    if (link.shareAdherence) {
      Object.assign(base, { adherence7d: { taken, skipped, missed, adherencePercent: adherence } });
    }
    if (link.shareMissed) {
      const missedDoses = logs
        .filter((l) => l.status === "SKIPPED" || l.status === "PENDING")
        .sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime())
        .slice(0, 20)
        .map((l) => ({
          id: l.id,
          medication: l.medication.name,
          scheduledAt: l.scheduledAt,
          dateKey: l.dateKey,
          status: l.status === "PENDING" ? "MISSED" : l.status,
        }));
      Object.assign(base, { recentMissedDoses: missedDoses });
    }
  }

  if (link.shareUpcoming) {
    const upcoming = await prisma.doseLog.findMany({
      where: { userId: patientId, dateKey: today, status: "PENDING" },
      include: { medication: { select: { name: true, doseAmount: true, doseUnit: true } } },
      orderBy: { scheduledAt: "asc" },
      take: 10,
    });
    Object.assign(base, {
      upcomingDoses: upcoming.map((d) => ({
        id: d.id,
        medication: d.medication.name,
        dose: `${d.medication.doseAmount} ${d.medication.doseUnit}`,
        scheduledAt: d.snoozedUntil ?? d.scheduledAt,
        snoozed: !!d.snoozedUntil && d.snoozedUntil > new Date(),
      })),
    });
  }

  if (link.shareRefills) {
    const requests = await prisma.refillRequest.findMany({
      where: { userId: patientId },
      include: { medication: { select: { name: true, quantityUnit: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    Object.assign(base, {
      refillRequests: requests.map((r) => ({
        id: r.id,
        medication: r.medication.name,
        quantityUnit: r.medication.quantityUnit,
        status: r.status,
        createdAt: r.createdAt,
      })),
    });
  }

  if (link.shareInventory) {
    const meds = await prisma.medication.findMany({
      where: { userId: patientId, status: "ACTIVE" },
    });
    Object.assign(base, {
      inventory: meds.map((m) => ({
        id: m.id,
        name: m.name,
        currentQuantity: m.currentQuantity,
        quantityUnit: m.quantityUnit,
        refillThreshold: m.refillThreshold,
        status: inventoryStatus(m),
      })),
    });
  }

  return base;
}
