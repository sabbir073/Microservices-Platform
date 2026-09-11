-- CreateEnum
CREATE TYPE "LeaderboardGiftStatus" AS ENUM ('PENDING', 'FULFILLED', 'CANCELLED');

-- CreateTable
CREATE TABLE "LeaderboardGiftAward" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "giftName" TEXT NOT NULL,
    "giftImage" TEXT,
    "status" "LeaderboardGiftStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "fulfilledAt" TIMESTAMP(3),
    "fulfilledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaderboardGiftAward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeaderboardGiftAward_userId_idx" ON "LeaderboardGiftAward"("userId");

-- CreateIndex
CREATE INDEX "LeaderboardGiftAward_status_idx" ON "LeaderboardGiftAward"("status");

-- CreateIndex
CREATE INDEX "LeaderboardGiftAward_cycleId_idx" ON "LeaderboardGiftAward"("cycleId");

-- CreateIndex
CREATE INDEX "LeaderboardGiftAward_fulfilledById_idx" ON "LeaderboardGiftAward"("fulfilledById");

-- The idempotency guarantee for gifts: one rank in one cycle is owed one gift,
-- no matter how many times the payout is retried, resumed or double-run.
-- CreateIndex
CREATE UNIQUE INDEX "LeaderboardGiftAward_cycleId_rank_key" ON "LeaderboardGiftAward"("cycleId", "rank");

-- AddForeignKey
ALTER TABLE "LeaderboardGiftAward" ADD CONSTRAINT "LeaderboardGiftAward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaderboardGiftAward" ADD CONSTRAINT "LeaderboardGiftAward_fulfilledById_fkey" FOREIGN KEY ("fulfilledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
