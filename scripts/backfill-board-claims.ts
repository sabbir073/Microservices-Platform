/**
 * One-shot backfill: convert legacy `Transaction.reference = "board_claim_<id>"`
 * rows into proper `BoardClaim` rows. Idempotent — skips boards the user has
 * already been backfilled for.
 *
 * Run via: npx tsx scripts/backfill-board-claims.ts
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const legacy = await prisma.transaction.findMany({
    where: { reference: { startsWith: "board_claim_" } },
    select: {
      id: true,
      userId: true,
      reference: true,
      points: true,
      metadata: true,
      createdAt: true,
    },
  });

  console.log(`Found ${legacy.length} legacy board-claim transactions.`);

  let created = 0;
  let skipped = 0;
  let missingBoard = 0;

  for (const t of legacy) {
    const boardId = t.reference?.replace("board_claim_", "") ?? null;
    if (!boardId) continue;

    const existing = await prisma.boardClaim.findUnique({
      where: { userId_boardId: { userId: t.userId, boardId } },
      select: { id: true },
    });
    if (existing) {
      skipped++;
      continue;
    }

    const board = await prisma.taskBoard.findUnique({
      where: { id: boardId },
      select: { id: true, pointsReward: true, xpReward: true },
    });
    if (!board) {
      missingBoard++;
      continue;
    }

    const xp =
      typeof t.metadata === "object" && t.metadata && "xp" in t.metadata
        ? Number((t.metadata as { xp?: number }).xp ?? 0)
        : board.xpReward;

    await prisma.boardClaim.create({
      data: {
        userId: t.userId,
        boardId,
        pointsEarned: t.points ?? board.pointsReward,
        xpEarned: xp,
        taskCount: 0,
        claimedAt: t.createdAt,
        transactionId: t.id,
      },
    });
    created++;
  }

  console.log(
    `Done. created=${created} skipped=${skipped} missingBoard=${missingBoard}`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
