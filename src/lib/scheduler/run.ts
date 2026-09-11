import { after } from "next/server";
import {
  claimWindow,
  finishWindow,
  type ClaimStore,
} from "@/lib/scheduler/claim";
import { prismaClaimStore } from "@/lib/scheduler/prisma-store";
import {
  SCHEDULED_JOBS,
  findJob,
  windowKeyFor,
  type JobSource,
  type ScheduledJobDef,
} from "@/lib/scheduler/jobs";

/**
 * The scheduler itself: due work, driven by the platform's own traffic.
 *
 * Nothing here needs configuring. There is no environment variable, no Vercel
 * cron entry, no secret. `kickScheduler()` is called from the root layout, so
 * every page render is a potential tick — and `after()` means the work starts
 * only once the visitor's response has already been sent. A visitor never waits
 * for a payout, and a job that explodes is invisible to whoever happened to
 * trigger it.
 *
 * Cost control, in three layers:
 *   1. a per-instance cooldown, so a burst of page views is one tick;
 *   2. a `completed` short-circuit that costs a single indexed read per job;
 *   3. a hard cap on how many jobs one tick may actually execute.
 */

/** One tick per instance per this long, however much traffic arrives. */
const KICK_COOLDOWN_MS = 30_000;
/** Nothing is allowed to turn a single page view into a long chain of work. */
const MAX_JOBS_PER_TICK = 2;
/** A failed attempt hands its window back after this, instead of pinning it. */
const FAILURE_BACKOFF_MS = 60_000;

let lastKickAt = 0;

export interface TickLine {
  job: string;
  windowKey: string;
  outcome:
    | "ran"
    | "failed"
    | "already-settled"
    | "held-by-another-tick"
    | "over-budget";
  attempt?: number;
  takeover?: boolean;
  durationMs?: number;
  summary?: string;
  error?: string;
}

export interface TickReport {
  at: string;
  lines: TickLine[];
}

async function runOne(
  store: ClaimStore,
  job: ScheduledJobDef,
  windowKey: string,
  now: Date,
  source: JobSource
): Promise<TickLine> {
  const claim = await claimWindow(store, job.name, windowKey, {
    now,
    leaseMs: job.leaseMs,
    source,
  });
  if (!claim.claimed) {
    return {
      job: job.name,
      windowKey,
      outcome:
        claim.reason === "completed"
          ? "already-settled"
          : "held-by-another-tick",
    };
  }

  const started = Date.now();
  try {
    const out = await job.run({ source });
    const durationMs = Date.now() - started;
    await finishWindow(store, job.name, windowKey, {
      ok: out.ok,
      durationMs,
      summary: out.summary,
      error: out.ok ? null : out.summary,
      result: out.result,
      retryAt: new Date(Date.now() + FAILURE_BACKOFF_MS),
    });
    return {
      job: job.name,
      windowKey,
      outcome: out.ok ? "ran" : "failed",
      attempt: claim.attempt,
      takeover: claim.takeover,
      durationMs,
      summary: out.summary,
    };
  } catch (err) {
    const durationMs = Date.now() - started;
    const message = err instanceof Error ? err.message : String(err);
    // Best effort: if this write is what died, the row stays `running` and the
    // lease expiring is what recovers it. That is the same path a killed tick
    // takes, and it is already correct.
    await finishWindow(store, job.name, windowKey, {
      ok: false,
      durationMs,
      summary: "Failed.",
      error: message,
      retryAt: new Date(Date.now() + FAILURE_BACKOFF_MS),
    }).catch(() => {});
    return {
      job: job.name,
      windowKey,
      outcome: "failed",
      attempt: claim.attempt,
      takeover: claim.takeover,
      durationMs,
      error: message,
    };
  }
}

/** Run whatever is due. Safe to call from anywhere, as often as you like. */
export async function runDueJobs(opts?: {
  source?: JobSource;
  now?: Date;
  only?: string | null;
  store?: ClaimStore;
}): Promise<TickReport> {
  const now = opts?.now ?? new Date();
  const source = opts?.source ?? "traffic";
  const store = opts?.store ?? prismaClaimStore;
  const jobs = opts?.only
    ? SCHEDULED_JOBS.filter((j) => j.name === opts.only)
    : SCHEDULED_JOBS;

  const lines: TickLine[] = [];
  let budget = MAX_JOBS_PER_TICK;

  for (const job of jobs) {
    const windowKey = windowKeyFor(job, now);
    if (budget <= 0) {
      lines.push({ job: job.name, windowKey, outcome: "over-budget" });
      continue;
    }
    const line = await runOne(store, job, windowKey, now, source);
    // Only work that actually ran spends budget; a no-op costs one read.
    if (line.outcome === "ran" || line.outcome === "failed") budget -= 1;
    lines.push(line);
  }

  return { at: now.toISOString(), lines };
}

/**
 * Run one job by hand, from the admin screen.
 *
 * It claims a window of its own (`manual-<ms>`) rather than the scheduled one.
 * Two reasons: a hand-run must never be refused just because this hour's window
 * is already settled, and it must never seal a scheduled window it did not
 * actually settle. Running the real work twice is harmless — that is the entry
 * requirement for being in the registry at all.
 */
export async function runJobNow(
  name: string,
  opts?: { store?: ClaimStore }
): Promise<TickLine | { job: string; outcome: "unknown-job" }> {
  const job = findJob(name);
  if (!job) return { job: name, outcome: "unknown-job" };
  const now = new Date();
  return runOne(
    opts?.store ?? prismaClaimStore,
    job,
    `manual-${now.getTime()}`,
    now,
    "manual"
  );
}

/**
 * Fire-and-forget the tick, after the response has been sent.
 *
 * Called from the root layout, so ordinary site traffic drives the schedule.
 * Every failure mode is swallowed on purpose: `after()` throws when there is no
 * request scope (a script, a unit test), and a job blowing up must never reach
 * the page a visitor is reading.
 */
export function kickScheduler(): void {
  // A production build renders pages; it must not start paying prize money.
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const now = Date.now();
  if (now - lastKickAt < KICK_COOLDOWN_MS) return;
  lastKickAt = now;
  try {
    after(async () => {
      try {
        await runDueJobs({ source: "traffic" });
      } catch {
        /* a visitor must never learn that a background job failed */
      }
    });
  } catch {
    /* no request scope — nothing to schedule against */
  }
}
