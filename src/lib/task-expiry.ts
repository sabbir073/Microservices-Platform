import { prisma } from "@/lib/prisma";

/**
 * Flip ACTIVE tasks whose `expiresAt` has passed to EXPIRED so they drop out of
 * the earn feeds. Idempotent — only touches still-ACTIVE past-deadline rows.
 */
export async function expireDueTasks(): Promise<{ expired: number }> {
  const now = new Date();
  const { count } = await prisma.task.updateMany({
    where: { status: "ACTIVE", expiresAt: { not: null, lte: now } },
    data: { status: "EXPIRED" },
  });
  return { expired: count };
}
