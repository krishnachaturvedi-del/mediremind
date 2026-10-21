import { describe, it, expect, beforeEach } from "vitest";
import {
  registerPatient,
  validMedication,
  makeChemistWithShop,
  loginAs,
  prisma,
} from "./helpers.js";

describe("refill workflow", () => {
  let patient: Awaited<ReturnType<typeof registerPatient>>;
  let chemistSetup: Awaited<ReturnType<typeof makeChemistWithShop>>;
  let medicationId: string;
  let requestId: string;

  beforeEach(async () => {
    patient = await registerPatient("refill");
    chemistSetup = await makeChemistWithShop();
    await patient.agent.post("/api/shops/link").send({ chemistShopId: chemistSetup.shop.id });
    const created = await patient.agent
      .post("/api/medications")
      .send(validMedication({ currentQuantity: 20, refillThreshold: 5 }));
    medicationId = created.body.medication.id;
  });

  it("patient requests a refill; only one active request allowed", async () => {
    const res = await patient.agent
      .post("/api/refills")
      .send({ medicationId, quantityRequested: 30, patientNote: "Please deliver" });
    expect(res.status).toBe(201);
    requestId = res.body.request.id;
    expect(res.body.request.status).toBe("PENDING");

    const dup = await patient.agent.post("/api/refills").send({ medicationId });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe("ACTIVE_REQUEST_EXISTS");
  });

  it("cannot request a refill for someone else's medication or without a chemist", async () => {
    const other = await registerPatient("refill-other");
    const res = await other.agent.post("/api/refills").send({ medicationId });
    expect(res.status).toBe(404); // medication not visible to other patient

    const noChemist = await registerPatient("refill-nochemist");
    const med = await noChemist.agent.post("/api/medications").send(validMedication());
    const res2 = await noChemist.agent.post("/api/refills").send({ medicationId: med.body.medication.id });
    expect(res2.status).toBe(400);
    expect(res2.body.error.code).toBe("NO_CHEMIST");
  });

  it("patient cancels a pending request", async () => {
    const created = await patient.agent.post("/api/refills").send({ medicationId });
    const cancel = await patient.agent.post(`/api/refills/${created.body.request.id}/cancel`);
    expect(cancel.status).toBe(200);
    expect(cancel.body.request.status).toBe("CANCELLED");
    // A new request is now possible.
    const again = await patient.agent.post("/api/refills").send({ medicationId });
    expect(again.status).toBe(201);
  });

  it("chemist accepts, marks ready and confirms with quantity supplied", async () => {
    const created = await patient.agent.post("/api/refills").send({ medicationId, quantityRequested: 30 });
    requestId = created.body.request.id;
    const chemistAgent = await loginAs(chemistSetup.email, chemistSetup.password);

    const list = await chemistAgent.get("/api/chemist/refills");
    expect(list.status).toBe(200);
    expect(list.body.requests).toHaveLength(1);
    expect(list.body.requests[0].id).toBe(requestId);

    const accept = await chemistAgent
      .post(`/api/chemist/refills/${requestId}/action`)
      .send({ action: "ACCEPT" });
    expect(accept.body.request.status).toBe("ACCEPTED");

    const ready = await chemistAgent
      .post(`/api/chemist/refills/${requestId}/action`)
      .send({ action: "READY" });
    expect(ready.body.request.status).toBe("READY");

    const complete = await chemistAgent
      .post(`/api/chemist/refills/${requestId}/action`)
      .send({ action: "COMPLETE", quantitySupplied: 30 });
    expect(complete.status).toBe(200);
    expect(complete.body.transaction.quantitySupplied).toBe(30);

    // Inventory increased: 20 + 30 = 50
    const meds = await patient.agent.get("/api/medications");
    const med = meds.body.medications.find((m: { id: string }) => m.id === medicationId);
    expect(med.currentQuantity).toBe(50);

    const patientRequests = await patient.agent.get("/api/refills");
    expect(patientRequests.body.requests[0].status).toBe("COMPLETED");
  });

  it("duplicate confirmation cannot increase inventory twice", async () => {
    const created = await patient.agent.post("/api/refills").send({ medicationId });
    requestId = created.body.request.id;
    const chemistAgent = await loginAs(chemistSetup.email, chemistSetup.password);
    await chemistAgent.post(`/api/chemist/refills/${requestId}/action`).send({ action: "ACCEPT" });

    const first = await chemistAgent
      .post(`/api/chemist/refills/${requestId}/action`)
      .send({ action: "COMPLETE", quantitySupplied: 40 });
    expect(first.status).toBe(200);

    const second = await chemistAgent
      .post(`/api/chemist/refills/${requestId}/action`)
      .send({ action: "COMPLETE", quantitySupplied: 40 });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("ALREADY_PROCESSED");

    const meds = await patient.agent.get("/api/medications");
    const med = meds.body.medications.find((m: { id: string }) => m.id === medicationId);
    expect(med.currentQuantity).toBe(60); // 20 + 40, exactly once
  });

  it("completing without a supplied quantity is rejected", async () => {
    const created = await patient.agent.post("/api/refills").send({ medicationId });
    const chemistAgent = await loginAs(chemistSetup.email, chemistSetup.password);
    await chemistAgent.post(`/api/chemist/refills/${created.body.request.id}/action`).send({ action: "ACCEPT" });
    const res = await chemistAgent
      .post(`/api/chemist/refills/${created.body.request.id}/action`)
      .send({ action: "COMPLETE" });
    expect(res.status).toBe(400);
  });

  it("chemist can reject with a reason", async () => {
    const created = await patient.agent.post("/api/refills").send({ medicationId });
    const chemistAgent = await loginAs(chemistSetup.email, chemistSetup.password);
    const res = await chemistAgent
      .post(`/api/chemist/refills/${created.body.request.id}/action`)
      .send({ action: "REJECT", rejectReason: "Out of stock this week" });
    expect(res.body.request.status).toBe("REJECTED");
    expect(res.body.request.rejectReason).toContain("Out of stock");

    const detail = await patient.agent.get("/api/refills");
    expect(detail.body.requests[0].status).toBe("REJECTED");
  });

  it("invalid status transitions are rejected", async () => {
    const created = await patient.agent.post("/api/refills").send({ medicationId });
    const chemistAgent = await loginAs(chemistSetup.email, chemistSetup.password);
    // READY before ACCEPT is invalid
    const res = await chemistAgent
      .post(`/api/chemist/refills/${created.body.request.id}/action`)
      .send({ action: "READY" });
    expect(res.status).toBe(409);
  });

  it("chemist can cancel a pending request without adding stock", async () => {
    const created = await patient.agent.post("/api/refills").send({ medicationId });
    const chemistAgent = await loginAs(chemistSetup.email, chemistSetup.password);
    const res = await chemistAgent
      .post(`/api/chemist/refills/${created.body.request.id}/action`)
      .send({ action: "CANCEL" });
    expect(res.status).toBe(200);
    expect(res.body.request.status).toBe("CANCELLED");
    expect(res.body.transaction).toBeNull();

    const med = await prisma.medication.findUnique({ where: { id: medicationId } });
    expect(med?.currentQuantity).toBe(20);
    const transactions = await prisma.refillTransaction.count({ where: { medicationId } });
    expect(transactions).toBe(0);
  });

  it("a completed request cannot then be cancelled", async () => {
    const created = await patient.agent.post("/api/refills").send({ medicationId });
    const id = created.body.request.id;
    const chemistAgent = await loginAs(chemistSetup.email, chemistSetup.password);
    await chemistAgent.post(`/api/chemist/refills/${id}/action`).send({ action: "ACCEPT" });
    await chemistAgent
      .post(`/api/chemist/refills/${id}/action`)
      .send({ action: "COMPLETE", quantitySupplied: 10 });
    const res = await chemistAgent
      .post(`/api/chemist/refills/${id}/action`)
      .send({ action: "CANCEL" });
    expect(res.status).toBe(409);
    const med = await prisma.medication.findUnique({ where: { id: medicationId } });
    expect(med?.currentQuantity).toBe(30);
  });

  it("chemist cannot see or act on requests from unrelated patients", async () => {
    const created = await patient.agent.post("/api/refills").send({ medicationId });
    const strangerSetup = await makeChemistWithShop("Stranger Pharmacy");
    const strangerAgent = await loginAs(strangerSetup.email, strangerSetup.password);

    const list = await strangerAgent.get("/api/chemist/refills");
    expect(list.body.requests).toHaveLength(0);

    const act = await strangerAgent
      .post(`/api/chemist/refills/${created.body.request.id}/action`)
      .send({ action: "ACCEPT" });
    expect(act.status).toBe(404);
  });

  it("refill confirmation resolves the open low-stock alert", async () => {
    // Drop stock below threshold via the inventory adjust endpoint.
    await patient.agent.post(`/api/inventory/${medicationId}/adjust`).send({ currentQuantity: 3 });
    const alertsOpen = await prisma.refillAlert.findMany({ where: { userId: patient.user.id, status: "OPEN" } });
    expect(alertsOpen.length).toBe(1);

    // The auto request created for the linked chemist gets completed.
    const autoRequest = await prisma.refillRequest.findFirst({
      where: { userId: patient.user.id, status: "PENDING" },
    });
    expect(autoRequest).toBeTruthy();
    const chemistAgent = await loginAs(chemistSetup.email, chemistSetup.password);
    await chemistAgent.post(`/api/chemist/refills/${autoRequest!.id}/action`).send({ action: "ACCEPT" });
    await chemistAgent
      .post(`/api/chemist/refills/${autoRequest!.id}/action`)
      .send({ action: "COMPLETE", quantitySupplied: 25 });

    const alertsAfter = await prisma.refillAlert.findMany({ where: { userId: patient.user.id, status: "OPEN" } });
    expect(alertsAfter).toHaveLength(0);
    const med = await prisma.medication.findUnique({ where: { id: medicationId } });
    expect(med?.currentQuantity).toBe(28);
  });

  it("inventory ledger shows used and refilled quantities", async () => {
    await patient.agent.post(`/api/inventory/${medicationId}/adjust`).send({ currentQuantity: 2 });
    const autoRequest = await prisma.refillRequest.findFirst({ where: { userId: patient.user.id, status: "PENDING" } });
    const chemistAgent = await loginAs(chemistSetup.email, chemistSetup.password);
    await chemistAgent.post(`/api/chemist/refills/${autoRequest!.id}/action`).send({ action: "ACCEPT" });
    await chemistAgent
      .post(`/api/chemist/refills/${autoRequest!.id}/action`)
      .send({ action: "COMPLETE", quantitySupplied: 15 });

    const ledger = await patient.agent.get(`/api/inventory/${medicationId}/ledger`);
    expect(ledger.status).toBe(200);
    const refillEntry = ledger.body.entries.find((e: { type: string }) => e.type === "REFILL_CONFIRMED");
    expect(refillEntry.delta).toBe(15);
  });
});
