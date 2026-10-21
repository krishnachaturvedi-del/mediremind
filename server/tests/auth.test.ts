import { describe, it, expect } from "vitest";
import request from "supertest";
import { app, prisma, uniqueEmail, registerPatient, loginAs, makeUser } from "./helpers.js";

describe("authentication", () => {
  it("registers a patient and starts a session", async () => {
    const { agent, email, user } = await registerPatient("reg");
    expect(user.role).toBe("PATIENT");
    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(email);
  });

  it("rejects duplicate registration", async () => {
    const { email, password } = await registerPatient("dup");
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Someone", email, password });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_TAKEN");
  });

  it("rejects invalid registration input", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "A", email: "not-an-email", password: "short" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("logs in with correct credentials and rejects wrong ones", async () => {
    const { email, password } = await registerPatient("login");
    const ok = await request(app).post("/api/auth/login").send({ email, password });
    expect(ok.status).toBe(200);
    expect(ok.body.user.email).toBe(email);

    const bad = await request(app).post("/api/auth/login").send({ email, password: "WrongPass1!" });
    expect(bad.status).toBe(401);
    expect(bad.body.error.message).toBe("Invalid email or password.");

    const unknown = await request(app)
      .post("/api/auth/login")
      .send({ email: "ghost@test.dev", password: "whatever123" });
    expect(unknown.status).toBe(401);
  });

  it("does not reveal whether an email exists on failed login", async () => {
    const known = await registerPatient("leak");
    const a = await request(app)
      .post("/api/auth/login")
      .send({ email: known.email, password: "BadPass999!" });
    const b = await request(app)
      .post("/api/auth/login")
      .send({ email: uniqueEmail("leak-unknown"), password: "BadPass999!" });
    expect(a.body.error.message).toBe(b.body.error.message);
  });

  it("logs out and destroys the session", async () => {
    const { agent } = await registerPatient("logout");
    await agent.post("/api/auth/logout");
    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(401);
  });

  it("protects /api/auth/me without a session", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("changes password and allows login with the new one", async () => {
    const { agent, email, password } = await registerPatient("chpw");
    const res = await agent
      .post("/api/auth/change-password")
      .send({ currentPassword: password, newPassword: "NewPass123!" });
    expect(res.status).toBe(200);
    await loginAs(email, "NewPass123!");
    const old = await request(app).post("/api/auth/login").send({ email, password });
    expect(old.status).toBe(401);
  });

  it("stores only password hashes, never plaintext", async () => {
    const { email, password } = await registerPatient("hash");
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user?.passwordHash).toBeTruthy();
    expect(user?.passwordHash).not.toContain(password);
    expect(user?.passwordHash.startsWith("$2")).toBe(true);
  });

  it("public registration cannot create CHEMIST accounts", async () => {
    const email = uniqueEmail("sneaky");
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Sneaky", email, password: "Password123!", role: "CHEMIST" });
    expect(res.status).toBe(201);
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user?.role).toBe("PATIENT");
  });
});

describe("role-based access control", () => {
  it("patient cannot access chemist endpoints", async () => {
    const { agent } = await registerPatient("rbac-p");
    const res = await agent.get("/api/chemist/refills");
    expect(res.status).toBe(403);
  });

  it("chemist cannot access patient refill endpoints", async () => {
    const { user, password } = await makeUser("CHEMIST");
    const agent = await loginAs(user.email, password);
    const res = await agent.get("/api/refills");
    expect(res.status).toBe(403);
  });

  it("unauthenticated requests are rejected on protected routes", async () => {
    for (const path of ["/api/medications", "/api/doses", "/api/inventory", "/api/dashboard"]) {
      const res = await request(app).get(path);
      expect(res.status).toBe(401);
    }
  });

  it("users cannot read each other's medications", async () => {
    const a = await registerPatient("own-a");
    const b = await registerPatient("own-b");
    const created = await a.agent.post("/api/medications").send({
      name: "Secret Med",
      doseAmount: 10, doseUnit: "mg", quantityPerDose: 1, quantityUnit: "tablets",
      frequency: "ONCE_DAILY", times: ["08:00"], currentQuantity: 10,
      refillThreshold: 2, startDate: "2026-01-01",
    });
    expect(created.status).toBe(201);
    const id = created.body.medication.id;

    const list = await b.agent.get("/api/medications");
    expect(list.body.medications.find((m: { id: string }) => m.id === id)).toBeUndefined();

    const get = await b.agent.get(`/api/medications/${id}`);
    expect(get.status).toBe(404);

    const patch = await b.agent.patch(`/api/medications/${id}`).send({ name: "Hacked" });
    expect(patch.status).toBe(404);
  });
});
