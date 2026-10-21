import bcrypt from "bcryptjs";
import { prisma } from "../db.js";
import { badRequest, conflict, unauthorized } from "../lib/errors.js";
import { audit } from "../lib/audit.js";

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Public registration. Only ever creates PATIENT accounts.
 * Chemist accounts are provisioned through a controlled administrative
 * process (see server/scripts/provision-chemist.ts); caregiver accounts are
 * created via the caregiver invitation workflow.
 */
export async function registerPatient(input: {
  name: string;
  email: string;
  password: string;
  phone?: string;
  ip?: string;
}) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw conflict("An account with this email already exists.", "EMAIL_TAKEN");
  }
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      role: "PATIENT",
      phone: input.phone,
    },
  });
  await audit({
    userId: user.id,
    action: "auth.register",
    entity: "User",
    entityId: user.id,
    ip: input.ip,
  });
  return user;
}

export async function loginUser(input: {
  email: string;
  password: string;
  ip?: string;
}) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  // Same message whether the user exists or not — do not leak account presence.
  if (!user) {
    await audit({ action: "auth.login.failed", details: input.email, ip: input.ip });
    throw unauthorized("Invalid email or password.");
  }
  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) {
    await audit({
      userId: user.id,
      action: "auth.login.failed",
      entity: "User",
      entityId: user.id,
      ip: input.ip,
    });
    throw unauthorized("Invalid email or password.");
  }
  await audit({
    userId: user.id,
    action: "auth.login",
    entity: "User",
    entityId: user.id,
    ip: input.ip,
  });
  return user;
}

export async function changePassword(input: {
  userId: string;
  currentPassword: string;
  newPassword: string;
  ip?: string;
}) {
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) throw unauthorized();
  const ok = await verifyPassword(input.currentPassword, user.passwordHash);
  if (!ok) throw badRequest("Current password is incorrect.", "BAD_PASSWORD");
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(input.newPassword) },
  });
  await audit({
    userId: user.id,
    action: "auth.password_changed",
    entity: "User",
    entityId: user.id,
    ip: input.ip,
  });
}

export function publicUser(user: {
  id: string;
  email: string;
  name: string;
  role: string;
  phone: string | null;
  createdAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    phone: user.phone,
    createdAt: user.createdAt,
  };
}
