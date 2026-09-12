-- CreateTable
CREATE TABLE "ScheduledJobRun" (
    "id" TEXT NOT NULL,
    "job" TEXT NOT NULL,
    "windowKey" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'running',
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "source" TEXT NOT NULL DEFAULT 'traffic',
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "summary" TEXT,
    "error" TEXT,
    "result" JSONB,

    CONSTRAINT "ScheduledJobRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduledJobRun_job_claimedAt_idx" ON "ScheduledJobRun"("job", "claimedAt");

-- CreateIndex
CREATE INDEX "ScheduledJobRun_state_idx" ON "ScheduledJobRun"("state");

-- This unique constraint IS the scheduler's lock: the first tick to insert a
-- (job, window) row owns that window, everyone else's insert is rejected.
-- CreateIndex
CREATE UNIQUE INDEX "ScheduledJobRun_job_windowKey_key" ON "ScheduledJobRun"("job", "windowKey");
