import { prisma } from "../db.js";
import type { Prisma, PrismaClient } from "@prisma/client";

type Client = Prisma.TransactionClient | PrismaClient;

/**
 * In-app notification center. External channels (email/SMS/push services) are
 * NOT configured in this environment; browser notifications are supported by
 * the frontend polling this store while the tab is open.
 *
 * Pass the surrounding transaction client when calling inside a transaction —
 * using the global client there would deadlock on SQLite's single-writer lock.
 */
export async function notify(opts: {
  userId: string;
  type?: string;
  title: string;
  body: string;
  link?: string;
}, client: Client = prisma) {
  return client.notification.create({
    data: {
      userId: opts.userId,
      type: opts.type ?? "GENERAL",
      title: opts.title,
      body: opts.body,
      link: opts.link,
    },
  });
}

export async function listNotifications(userId: string, unreadOnly = false) {
  return prisma.notification.findMany({
    where: { userId, ...(unreadOnly ? { read: false } : {}) },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function markRead(userId: string, id: string) {
  // Ownership enforced by where clause.
  const { count } = await prisma.notification.updateMany({
    where: { id, userId },
    data: { read: true },
  });
  return count;
}

export async function markAllRead(userId: string) {
  const { count } = await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
  return count;
}
