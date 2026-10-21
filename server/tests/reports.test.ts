import { describe, it, expect } from "vitest";
import { registerPatient, validMedication, prisma } from "./helpers.js";
import { dateKeyOf, shiftDateKey } from "../src/lib/time.js";

function range(days = 7): { from: string; to: string } {
  const today = dateKeyOf(new Date());
  return { from: shiftDateKey(today, -(days - 1)), to: today };
}

describe("dose history and reports", () => {
  it("counts taken/skipped and treats past pending doses as missed", async () => {
    const { agent, user } = await registerPatient("rep-basic");
    const created = await agent.post("/api/medications").send(validMedication());
    const medId = created.body.medication.id;
    const today = dateKeyOf(new Date());
    const yesterday = shiftDateKey(today, -1);
    const twoDaysAgo = shiftDateKey(today, -2);
    const tomorrow = shiftDateKey(today, 1);

    await prisma.doseLog.createMany({
      data: [
        { medicationId: medId, userId: user.id, dateKey: yesterday, timeStr: "08:00", scheduledAt: new Date(`${yesterday}T08:00:00`), status: "TAKEN", actionAt: new Date(), quantityDelta: -1 },
        { medicationId: medId, userId: user.id, dateKey: yesterday, timeStr: "20:00", scheduledAt: new Date(`${yesterday}T20:00:00`), status: "SKIPPED", actionAt: new Date() },
        { medicationId: medId, userId: user.id, dateKey: twoDaysAgo, timeStr: "08:00", scheduledAt: new Date(`${twoDaysAgo}T08:00:00`), status: "PENDING" },
        { medicationId: medId, userId: user.id, dateKey: tomorrow, timeStr: "08:00", scheduledAt: new Date(`${tomorrow}T08:00:00`), status: "PENDING" },
      ],
    });

    const q = range(7);
    const res = await agent.get(`/api/reports/doses?from=${q.from}&to=${tomorrow}`);
    expect(res.status).toBe(200);
    const s = res.body.summary;
    expect(s.taken).toBe(1);
    expect(s.skipped).toBe(1);
    expect(s.missed).toBe(1); // past pending
    expect(s.scheduledFuture).toBe(1); // tomorrow never counted as missed
    // adherence = taken / (taken+skipped+missed) = 1/3 = 33%
    expect(s.adherencePercent).toBe(33);

    const byMed = res.body.byMedication[0];
    expect(byMed.taken).toBe(1);
    expect(byMed.name).toBe("Metformin 500");
  });

  it("supports medication and status filters", async () => {
    const { agent, user } = await registerPatient("rep-filter");
    const a = await agent.post("/api/medications").send(validMedication({ name: "Med A", frequency: "ONCE_DAILY", times: ["08:00"] }));
    await agent.post("/api/medications").send(validMedication({ name: "Med B", frequency: "ONCE_DAILY", times: ["09:00"] }));
    const today = dateKeyOf(new Date());
    await prisma.doseLog.createMany({
      data: [
        { medicationId: a.body.medication.id, userId: user.id, dateKey: today, timeStr: "08:00", scheduledAt: new Date(`${today}T08:00:00`), status: "TAKEN", actionAt: new Date(), quantityDelta: -1 },
      ],
    });
    const q = range(3);
    const byMed = await agent.get(`/api/reports/doses?from=${q.from}&to=${q.to}&medicationId=${a.body.medication.id}`);
    expect(byMed.body.rows).toHaveLength(1);
    const takenOnly = await agent.get(`/api/reports/doses?from=${q.from}&to=${q.to}&status=TAKEN`);
    expect(takenOnly.body.rows.every((r: { status: string }) => r.status === "TAKEN")).toBe(true);
  });

  it("rejects invalid ranges", async () => {
    const { agent } = await registerPatient("rep-range");
    const today = dateKeyOf(new Date());
    const res = await agent.get(`/api/reports/doses?from=${today}&to=${shiftDateKey(today, -3)}`);
    expect(res.status).toBe(400);
    const malformed = await agent.get(`/api/reports/doses?from=hello&to=${today}`);
    expect(malformed.status).toBe(400);
  });

  it("exports CSV with proper headers", async () => {
    const { agent, user } = await registerPatient("rep-csv");
    const created = await agent.post("/api/medications").send(validMedication({ frequency: "ONCE_DAILY", times: ["08:00"] }));
    const today = dateKeyOf(new Date());
    await prisma.doseLog.create({
      data: {
        medicationId: created.body.medication.id, userId: user.id,
        dateKey: today, timeStr: "08:00", scheduledAt: new Date(`${today}T08:00:00`),
        status: "TAKEN", actionAt: new Date(), quantityDelta: -1,
      },
    });
    const q = range(3);
    const res = await agent.get(`/api/reports/doses.csv?from=${q.from}&to=${q.to}`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.text.split("\n")[0]).toBe(
      "date,time,medication,doseUnit,status,recordedStatus,scheduledAt,actionAt,inventoryDelta"
    );
    expect(res.text).toContain("Metformin 500");
  });

  it("provides a daily adherence trend", async () => {
    const { agent } = await registerPatient("rep-trend");
    await agent.post("/api/medications").send(validMedication());
    const res = await agent.get("/api/reports/trend?days=7");
    expect(res.status).toBe(200);
    expect(res.body.trend).toHaveLength(7);
    expect(res.body.trend[0]).toHaveProperty("date");
    expect(res.body.trend[0]).toHaveProperty("taken");
  });

  it("dashboard aggregates real data with empty state support", async () => {
    const empty = await registerPatient("dash-empty");
    const emptyDash = await empty.agent.get("/api/dashboard");
    expect(emptyDash.status).toBe(200);
    expect(emptyDash.body.hasMedications).toBe(false);
    expect(emptyDash.body.schedule.total).toBe(0);

    const { agent, user } = await registerPatient("dash-full");
    await agent.post("/api/medications").send(validMedication({ currentQuantity: 3, refillThreshold: 5 }));
    const doses = await agent.get("/api/doses");
    const res = await agent.post(`/api/doses/${doses.body.doses[0].id}/action`).send({ action: "TAKEN" });
    expect(res.status).toBe(200);

    const dash = await agent.get("/api/dashboard");
    expect(dash.body.hasMedications).toBe(true);
    expect(dash.body.schedule.taken).toBe(1);
    expect(dash.body.schedule.pending).toBe(1);
    expect(dash.body.medications.active).toBe(1);
    expect(dash.body.inventory.lowStockCount).toBe(1);
    expect(dash.body.nextDose).toBeTruthy();
    expect(dash.body.recentActivity).toHaveLength(1);
    void user;
  });
});
