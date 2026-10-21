import { describe, it, expect } from "vitest";
import { registerPatient, validMedication, prisma } from "./helpers.js";
import { dateKeyOf } from "../src/lib/time.js";

describe("dose logging and inventory", () => {
  it("materializes today's schedule from medication times", async () => {
    const { agent } = await registerPatient("dose-sched");
    await agent.post("/api/medications").send(validMedication());
    const res = await agent.get("/api/doses");
    expect(res.status).toBe(200);
    expect(res.body.doses).toHaveLength(2);
    expect(res.body.doses.every((d: { status: string }) => d.status === "PENDING")).toBe(true);
    expect(res.body.doses.map((d: { timeStr: string }) => d.timeStr)).toEqual(["08:00", "20:00"]);
  });

  it("does not create duplicate dose rows on repeated schedule reads", async () => {
    const { agent, user } = await registerPatient("dose-dedup");
    await agent.post("/api/medications").send(validMedication());
    await agent.get("/api/doses");
    await agent.get("/api/doses");
    await agent.get("/api/doses");
    const count = await prisma.doseLog.count({
      where: { dateKey: dateKeyOf(new Date()), userId: user.id },
    });
    expect(count).toBe(2);
  });

  it("TAKEN deducts configured inventory and logs the delta", async () => {
    const { agent, user } = await registerPatient("dose-take");
    await agent.post("/api/medications").send(validMedication({ currentQuantity: 30, quantityPerDose: 2 }));
    const { body } = await agent.get("/api/doses");
    const dose = body.doses[0];

    const res = await agent.post(`/api/doses/${dose.id}/action`).send({ action: "TAKEN" });
    expect(res.status).toBe(200);
    expect(res.body.dose.status).toBe("TAKEN");
    expect(res.body.dose.quantityDelta).toBe(-2);

    const med = await prisma.medication.findFirst({ where: { userId: user.id } });
    expect(med?.currentQuantity).toBe(28);
  });

  it("prevents duplicate TAKEN submissions (no double deduction)", async () => {
    const { agent, user } = await registerPatient("dose-dupe");
    await agent.post("/api/medications").send(validMedication({ currentQuantity: 30 }));
    const { body } = await agent.get("/api/doses");
    const dose = body.doses[0];

    const first = await agent.post(`/api/doses/${dose.id}/action`).send({ action: "TAKEN" });
    expect(first.status).toBe(200);
    const second = await agent.post(`/api/doses/${dose.id}/action`).send({ action: "TAKEN" });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("DOSE_ALREADY_RECORDED");

    const med = await prisma.medication.findFirst({ where: { userId: user.id } });
    expect(med?.currentQuantity).toBe(29); // deducted once only
  });

  it("SKIPPED does not deduct inventory", async () => {
    const { agent, user } = await registerPatient("dose-skip");
    await agent.post("/api/medications").send(validMedication({ currentQuantity: 30 }));
    const { body } = await agent.get("/api/doses");
    const res = await agent.post(`/api/doses/${body.doses[0].id}/action`).send({ action: "SKIPPED" });
    expect(res.status).toBe(200);
    expect(res.body.dose.status).toBe("SKIPPED");
    expect(res.body.dose.quantityDelta).toBe(0);
    const med = await prisma.medication.findFirst({ where: { userId: user.id } });
    expect(med?.currentQuantity).toBe(30);
  });

  it("SNOOZE keeps the dose pending with a new reminder time", async () => {
    const { agent } = await registerPatient("dose-snooze");
    await agent.post("/api/medications").send(validMedication());
    const { body } = await agent.get("/api/doses");
    const dose = body.doses[0];

    const res = await agent.post(`/api/doses/${dose.id}/action`).send({ action: "SNOOZE", snoozeMinutes: 15 });
    expect(res.status).toBe(200);
    expect(res.body.dose.status).toBe("PENDING");
    expect(res.body.dose.snoozedUntil).toBeTruthy();
    const until = new Date(res.body.dose.snoozedUntil).getTime();
    const diffMin = (until - Date.now()) / 60000;
    expect(diffMin).toBeGreaterThan(13);
    expect(diffMin).toBeLessThan(17);
  });

  it("rejects snooze beyond the maximum and unknown doses", async () => {
    const { agent } = await registerPatient("dose-bad");
    await agent.post("/api/medications").send(validMedication());
    const { body } = await agent.get("/api/doses");
    const bad = await agent.post(`/api/doses/${body.doses[0].id}/action`).send({ action: "SNOOZE", snoozeMinutes: 9999 });
    expect(bad.status).toBe(400);
    const missing = await agent.post("/api/doses/nonexistent/action").send({ action: "TAKEN" });
    expect(missing.status).toBe(404);
  });

  it("users cannot act on other users' doses", async () => {
    const a = await registerPatient("dose-theft-a");
    const b = await registerPatient("dose-theft-b");
    await a.agent.post("/api/medications").send(validMedication());
    const { body } = await a.agent.get("/api/doses");
    const res = await b.agent.post(`/api/doses/${body.doses[0].id}/action`).send({ action: "TAKEN" });
    expect(res.status).toBe(404);
  });

  it("stock never goes negative even if quantityPerDose exceeds stock", async () => {
    const { agent, user } = await registerPatient("dose-zero");
    await agent.post("/api/medications").send(validMedication({ currentQuantity: 1, quantityPerDose: 5 }));
    const { body } = await agent.get("/api/doses");
    const res = await agent.post(`/api/doses/${body.doses[0].id}/action`).send({ action: "TAKEN" });
    expect(res.status).toBe(200);
    const med = await prisma.medication.findFirst({ where: { userId: user.id } });
    expect(med?.currentQuantity).toBe(0);
  });

  it("raises a refill alert when stock crosses the threshold", async () => {
    const { agent, user } = await registerPatient("dose-threshold");
    await agent.post("/api/medications").send(validMedication({ currentQuantity: 10, refillThreshold: 9 }));
    const { body } = await agent.get("/api/doses");
    // taking one dose: 10 -> 9, equals threshold => alert
    await agent.post(`/api/doses/${body.doses[0].id}/action`).send({ action: "TAKEN" });

    const alerts = await prisma.refillAlert.findMany({ where: { userId: user.id, status: "OPEN" } });
    expect(alerts.length).toBe(1);
    expect(alerts[0].quantityAtTrigger).toBe(9);

    // second dose: 9 -> 8; must NOT create a second open alert
    const { body: after } = await agent.get("/api/doses");
    const pending = after.doses.find((d: { status: string }) => d.status === "PENDING");
    await agent.post(`/api/doses/${pending.id}/action`).send({ action: "TAKEN" });
    const alerts2 = await prisma.refillAlert.findMany({ where: { userId: user.id, status: "OPEN" } });
    expect(alerts2.length).toBe(1);

    const notifications = await prisma.notification.findMany({ where: { userId: user.id, type: "REFILL_ALERT" } });
    expect(notifications.length).toBeGreaterThanOrEqual(1);
  });

  it("creates an automatic refill request when the patient has a linked chemist", async () => {
    const { agent, user } = await registerPatient("dose-autoreq");
    const shops = await agent.get("/api/shops");
    await agent.post("/api/shops/link").send({ chemistShopId: shops.body.shops[0].id });
    await agent.post("/api/medications").send(validMedication({ currentQuantity: 9, refillThreshold: 9 }));

    const { body } = await agent.get("/api/doses");
    await agent.post(`/api/doses/${body.doses[0].id}/action`).send({ action: "TAKEN" });

    const requests = await prisma.refillRequest.findMany({ where: { userId: user.id } });
    expect(requests.length).toBe(1);
    expect(requests[0].origin).toBe("AUTO");
    expect(requests[0].status).toBe("PENDING");
  });
});
