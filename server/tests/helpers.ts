import request from "supertest";
import bcrypt from "bcryptjs";
import { createApp } from "../src/app.js";
import { prisma } from "../src/db.js";

export const app = createApp();

let counter = 0;
export function uniqueEmail(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}@test.dev`;
}

export async function makeUser(
  role: "PATIENT" | "CHEMIST" | "CAREGIVER",
  prefix = role.toLowerCase()
) {
  const email = uniqueEmail(prefix);
  const password = "Password123!";
  const user = await prisma.user.create({
    data: {
      email,
      name: `Test ${role} ${counter}`,
      passwordHash: await bcrypt.hash(password, 12),
      role,
    },
  });
  return { user, email, password };
}

export async function makeChemistWithShop(shopName = "Test Pharmacy") {
  const { user, email, password } = await makeUser("CHEMIST");
  const shop = await prisma.chemistShop.create({
    data: {
      name: shopName,
      licenseNumber: `LIC-${Date.now()}-${counter}`,
      address: "1 Test Street",
      phone: "+91 00000 00000",
      ownerId: user.id,
    },
  });
  return { chemist: user, shop, email, password };
}

export async function loginAs(email: string, password: string) {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/login").send({ email, password });
  if (res.status !== 200) {
    throw new Error(`Login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return agent;
}

export async function registerPatient(prefix = "patient") {
  const email = uniqueEmail(prefix);
  const password = "Password123!";
  const agent = request.agent(app);
  const res = await agent
    .post("/api/auth/register")
    .send({ name: "Test Patient", email, password });
  if (res.status !== 201) {
    throw new Error(`Registration failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { agent, email, password, user: res.body.user };
}

export const validMedication = (overrides: Record<string, unknown> = {}) => ({
  name: "Metformin 500",
  doseAmount: 500,
  doseUnit: "mg",
  quantityPerDose: 1,
  quantityUnit: "tablets",
  frequency: "TWICE_DAILY",
  times: ["08:00", "20:00"],
  currentQuantity: 30,
  refillThreshold: 8,
  startDate: "2026-01-01",
  ...overrides,
});

export { prisma };
