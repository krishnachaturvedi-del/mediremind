import { describe, it, expect } from "vitest";
import { registerPatient, validMedication, prisma } from "./helpers.js";

describe("medication management", () => {
  it("creates a medication with valid input", async () => {
    const { agent, user } = await registerPatient("med-create");
    const res = await agent.post("/api/medications").send(validMedication());
    expect(res.status).toBe(201);
    const med = res.body.medication;
    expect(med.name).toBe("Metformin 500");
    expect(med.times).toEqual(["08:00", "20:00"]);
    expect(med.status).toBe("ACTIVE");
    const stored = await prisma.medication.findUnique({ where: { id: med.id } });
    expect(stored?.userId).toBe(user.id);
  });

  it("rejects negative quantities and zero doses", async () => {
    const { agent } = await registerPatient("med-neg");
    const negQty = await agent.post("/api/medications").send(validMedication({ currentQuantity: -5 }));
    expect(negQty.status).toBe(400);
    const negDose = await agent.post("/api/medications").send(validMedication({ doseAmount: 0 }));
    expect(negDose.status).toBe(400);
    const negThreshold = await agent.post("/api/medications").send(validMedication({ refillThreshold: -1 }));
    expect(negThreshold.status).toBe(400);
  });

  it("rejects frequency/times mismatches and duplicate times", async () => {
    const { agent } = await registerPatient("med-freq");
    const mismatch = await agent
      .post("/api/medications")
      .send(validMedication({ frequency: "TWICE_DAILY", times: ["08:00"] }));
    expect(mismatch.status).toBe(400);
    expect(JSON.stringify(mismatch.body.error.issues)).toContain("exactly 2");

    const dupes = await agent
      .post("/api/medications")
      .send(validMedication({ frequency: "CUSTOM", times: ["08:00", "08:00"] }));
    expect(dupes.status).toBe(400);

    const badTime = await agent
      .post("/api/medications")
      .send(validMedication({ frequency: "CUSTOM", times: ["25:99"] }));
    expect(badTime.status).toBe(400);
  });

  it("rejects end date before start date and missing name", async () => {
    const { agent } = await registerPatient("med-dates");
    const endBeforeStart = await agent
      .post("/api/medications")
      .send(validMedication({ endDate: "2025-12-31" }));
    expect(endBeforeStart.status).toBe(400);
    const noName = await agent.post("/api/medications").send(validMedication({ name: "" }));
    expect(noName.status).toBe(400);
  });

  it("edits medication fields and validates merged values", async () => {
    const { agent } = await registerPatient("med-edit");
    const created = await agent.post("/api/medications").send(validMedication());
    const id = created.body.medication.id;

    const patched = await agent.patch(`/api/medications/${id}`).send({ name: "Metformin 850", refillThreshold: 12 });
    expect(patched.status).toBe(200);
    expect(patched.body.medication.name).toBe("Metformin 850");
    expect(patched.body.medication.refillThreshold).toBe(12);
    expect(patched.body.medication.doseAmount).toBe(500); // unchanged

    const bad = await agent.patch(`/api/medications/${id}`).send({ currentQuantity: -3 });
    expect(bad.status).toBe(400);
  });

  it("pauses and resumes medications (soft deactivation)", async () => {
    const { agent } = await registerPatient("med-pause");
    const created = await agent.post("/api/medications").send(validMedication());
    const id = created.body.medication.id;

    const paused = await agent.post(`/api/medications/${id}/status`).send({ status: "PAUSED" });
    expect(paused.body.medication.status).toBe("PAUSED");

    const list = await agent.get("/api/medications?status=ACTIVE");
    expect(list.body.medications.find((m: { id: string }) => m.id === id)).toBeUndefined();

    const resumed = await agent.post(`/api/medications/${id}/status`).send({ status: "ACTIVE" });
    expect(resumed.body.medication.status).toBe("ACTIVE");
  });

  it("searches medications by name", async () => {
    const { agent } = await registerPatient("med-search");
    await agent.post("/api/medications").send(validMedication({ name: "Amlodipine 5" }));
    await agent.post("/api/medications").send(validMedication({ name: "Losartan 50" }));
    const res = await agent.get("/api/medications?search=amlo");
    expect(res.body.medications).toHaveLength(1);
    expect(res.body.medications[0].name).toBe("Amlodipine 5");
  });

  it("computes inventory status and estimates", async () => {
    const { agent } = await registerPatient("med-inv");
    await agent.post("/api/medications").send(validMedication({ name: "Healthy Med", currentQuantity: 100, refillThreshold: 10 }));
    await agent.post("/api/medications").send(validMedication({ name: "Low Med", currentQuantity: 12, refillThreshold: 10, frequency: "ONCE_DAILY", times: ["08:00"] }));
    await agent.post("/api/medications").send(validMedication({ name: "Critical Med", currentQuantity: 3, refillThreshold: 10, frequency: "ONCE_DAILY", times: ["08:00"] }));

    const res = await agent.get("/api/medications");
    const byName = Object.fromEntries(res.body.medications.map((m: { name: string }) => [m.name, m]));
    expect(byName["Healthy Med"].inventoryStatus).toBe("IN_STOCK");
    expect(byName["Low Med"].inventoryStatus).toBe("LOW_STOCK");
    expect(byName["Critical Med"].inventoryStatus).toBe("REFILL_REQUIRED");
    // 3 tablets, 1/day -> 3 days
    expect(byName["Critical Med"].estimatedDaysLeft).toBe(3);
  });
});
