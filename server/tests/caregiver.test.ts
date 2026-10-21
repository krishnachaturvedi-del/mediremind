import { describe, it, expect } from "vitest";
import { registerPatient, validMedication, makeUser, loginAs, prisma } from "./helpers.js";
import { dateKeyOf } from "../src/lib/time.js";

describe("caregiver consent workflow", () => {
  it("rejects inviting an email without an account", async () => {
    const { agent } = await registerPatient("cg-noacc");
    const res = await agent.post("/api/caregiver/invite").send({ email: "ghost@nowhere.dev" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("CAREGIVER_NOT_FOUND");
  });

  it("rejects self-invite", async () => {
    const { agent, email } = await registerPatient("cg-self");
    const res = await agent.post("/api/caregiver/invite").send({ email });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("SELF_INVITE");
  });

  it("rejects inviting an account that is not a caregiver", async () => {
    const patient = await registerPatient("cg-role");
    const otherPatient = await registerPatient("cg-role-target");
    const res = await patient.agent
      .post("/api/caregiver/invite")
      .send({ email: otherPatient.email });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("CAREGIVER_ROLE_REQUIRED");
  });

  it("full invite -> accept -> access -> revoke lifecycle", async () => {
    const patient = await registerPatient("cg-patient");
    const caregiverAcct = await makeUser("CAREGIVER");
    const caregiverAgent = await loginAs(caregiverAcct.email, caregiverAcct.password);

    // Patient has a medication and some schedule data.
    await patient.agent.post("/api/medications").send(validMedication({ currentQuantity: 40 }));
    await patient.agent.get("/api/doses");

    // 1. Invite
    const invite = await patient.agent
      .post("/api/caregiver/invite")
      .send({ email: caregiverAcct.email, shareInventory: false });
    expect(invite.status).toBe(201);
    expect(invite.body.link.status).toBe("PENDING");
    const linkId = invite.body.link.id;

    // 2. No access before acceptance.
    const early = await caregiverAgent.get(`/api/caregiver/patients/${patient.user.id}/summary`);
    expect(early.status).toBe(403);

    // 3. Caregiver accepts.
    const accept = await caregiverAgent.post(`/api/caregiver/invitations/${linkId}/respond`).send({ accept: true });
    expect(accept.body.link.status).toBe("ACTIVE");

    // 4. Access now works, respecting scopes.
    const summary = await caregiverAgent.get(`/api/caregiver/patients/${patient.user.id}/summary`);
    expect(summary.status).toBe(200);
    expect(summary.body.scopes.shareInventory).toBe(false);
    expect(summary.body.inventory).toBeUndefined();
    expect(summary.body.upcomingDoses).toBeDefined();
    expect(summary.body.adherence7d).toBeDefined();

    // 5. Patient narrows scopes: inventory stays hidden, adherence off too.
    await patient.agent.patch(`/api/caregiver/links/${linkId}/scopes`).send({
      shareAdherence: false, shareMissed: false, shareUpcoming: true, shareRefills: true, shareInventory: false,
    });
    const narrowed = await caregiverAgent.get(`/api/caregiver/patients/${patient.user.id}/summary`);
    expect(narrowed.body.adherence7d).toBeUndefined();
    expect(narrowed.body.upcomingDoses).toBeDefined();

    // 6. Revoke -> immediate denial.
    const revoke = await patient.agent.delete(`/api/caregiver/links/${linkId}`);
    expect(revoke.body.link.status).toBe("REVOKED");
    const denied = await caregiverAgent.get(`/api/caregiver/patients/${patient.user.id}/summary`);
    expect(denied.status).toBe(403);
  });

  it("caregivers cannot read summaries without an ACTIVE link", async () => {
    const patient = await registerPatient("cg-stranger");
    const caregiverAcct = await makeUser("CAREGIVER");
    const caregiverAgent = await loginAs(caregiverAcct.email, caregiverAcct.password);
    const res = await caregiverAgent.get(`/api/caregiver/patients/${patient.user.id}/summary`);
    expect(res.status).toBe(403);
  });

  it("patients cannot accept invitations meant for caregivers", async () => {
    const patient = await registerPatient("cg-p2");
    const otherCaregiver = await makeUser("CAREGIVER");
    const otherAgent = await loginAs(otherCaregiver.email, otherCaregiver.password);
    const invite = await patient.agent
      .post("/api/caregiver/invite")
      .send({ email: otherCaregiver.email });
    const linkId = invite.body.link.id;

    // Wrong caregiver tries to accept.
    const wrongCaregiver = await makeUser("CAREGIVER");
    const wrongAgent = await loginAs(wrongCaregiver.email, wrongCaregiver.password);
    const res = await wrongAgent.post(`/api/caregiver/invitations/${linkId}/respond`).send({ accept: true });
    expect(res.status).toBe(404);

    // The right one can.
    const ok = await otherAgent.post(`/api/caregiver/invitations/${linkId}/respond`).send({ accept: true });
    expect(ok.body.link.status).toBe("ACTIVE");
  });

  it("declining an invite revokes it", async () => {
    const patient = await registerPatient("cg-decline");
    const caregiverAcct = await makeUser("CAREGIVER");
    const caregiverAgent = await loginAs(caregiverAcct.email, caregiverAcct.password);
    const invite = await patient.agent.post("/api/caregiver/invite").send({ email: caregiverAcct.email });
    const res = await caregiverAgent
      .post(`/api/caregiver/invitations/${invite.body.link.id}/respond`)
      .send({ accept: false });
    expect(res.body.link.status).toBe("REVOKED");
  });

  it("caregiver role cannot invite other caregivers", async () => {
    const caregiverAcct = await makeUser("CAREGIVER");
    const agent = await loginAs(caregiverAcct.email, caregiverAcct.password);
    const target = await makeUser("CAREGIVER");
    const res = await agent.post("/api/caregiver/invite").send({ email: target.email });
    expect(res.status).toBe(403);
  });

  it("caregiver summary counts missed doses only for past days", async () => {
    const patient = await registerPatient("cg-missed");
    const caregiverAcct = await makeUser("CAREGIVER");
    const caregiverAgent = await loginAs(caregiverAcct.email, caregiverAcct.password);
    await patient.agent.post("/api/medications").send(validMedication());

    // Force-create a PENDING dose for two days ago => counts as MISSED.
    const med = await prisma.medication.findFirst({ where: { userId: patient.user.id } });
    const past = new Date();
    past.setDate(past.getDate() - 2);
    const pastKey = dateKeyOf(past);
    await prisma.doseLog.create({
      data: {
        medicationId: med!.id, userId: patient.user.id,
        dateKey: pastKey, timeStr: "08:00",
        scheduledAt: new Date(`${pastKey}T08:00:00`),
        status: "PENDING",
      },
    });

    const invite = await patient.agent.post("/api/caregiver/invite").send({ email: caregiverAcct.email });
    await caregiverAgent.post(`/api/caregiver/invitations/${invite.body.link.id}/respond`).send({ accept: true });

    const summary = await caregiverAgent.get(`/api/caregiver/patients/${patient.user.id}/summary`);
    expect(summary.body.adherence7d.missed).toBe(1);
    expect(summary.body.recentMissedDoses).toHaveLength(1);
    expect(summary.body.recentMissedDoses[0].status).toBe("MISSED");
  });
});
