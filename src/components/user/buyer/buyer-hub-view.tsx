"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Wallet,
  Plus,
  Users,
  Receipt,
  ListChecks,
  Sparkles,
  AlertCircle,
  Clock,
  Pause,
  Play,
  Loader2,
  ShieldCheck,
  Eye,
  ExternalLink,
  Pencil,
  Trash2,
  Target,
} from "lucide-react";
import { usd, pts, cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirm";
import { TASK_CREDIT } from "@/lib/task-credit-theme";
import { Modal } from "@/components/user/profile/profile-ui";
import type { BuyerPlatform } from "@/components/user/tasks/create-task-view";
import {
  TaskAudienceTargeting,
  type TaskAudienceValue,
} from "@/components/admin/tasks/task-audience-targeting";

export interface BuyerTaskRow {
  id: string;
  title: string;
  type: string;
  status: string;
  pointsReward: number;
  targetCount: number;
  budgetPoints: number;
  remainingBudget: number;
  approvedCount: number;
  pendingCount: number;
  rejectionReason: string | null;
  createdAt: string;
  // Everything the edit form needs. Optional because nothing outside this
  // file constructs a BuyerTaskRow without them, but a future caller that
  // only needs the list view (no editing) shouldn't be forced to fetch them.
  description?: string;
  instructions?: string | null;
  socialUrl?: string | null;
  socialPlatform?: string | null;
  socialAction?: string | null;
  minLevel?: number;
  countries?: string[];
  genders?: string[];
  regions?: string[];
  divisions?: string[];
  districts?: string[];
  subDistricts?: string[];
  postalCodes?: string[];
  minAge?: number | null;
  maxAge?: number | null;
}

/** Statuses the buyer may still edit. Mirrors `EDITABLE` in the PATCH route —
 *  offering Edit on a finished task would show a control the server refuses. */
const EDITABLE_STATUSES = new Set(["PENDING_REVIEW", "ACTIVE", "PAUSED"]);

interface ProofRow {
  id: string;
  status: string;
  proof: string | null;
  proofImages: string[];
  pointsPaid: number;
  at: string;
}

export interface InvoiceRow {
  id: string;
  reference: string;
  description: string;
  /** Negative = charged to the buyer, positive = refunded to them. */
  amountUsd: number;
  /** Credit moved. Negative = spent, positive = bought. */
  points: number;
  createdAt: string;
}

/**
 * Status wording written for the buyer, not for the database.
 *
 * `PENDING_REVIEW` tells them nothing about what is happening or what they
 * should do; "Waiting for approval" does. Colour carries the same meaning for
 * anyone scanning the list rather than reading it.
 */
/**
 * Completions of runway below which a buyer is warned.
 *
 * Not zero: at zero the tasks have already stopped and the damage is done.
 * Five is roughly "you have a day or two on a task that is moving", which is
 * enough time to act without nagging anyone who is comfortably funded.
 */
const LOW_RUNWAY = 5;

const STATUS: Record<string, { label: string; tone: string }> = {
  PENDING_REVIEW: {
    label: "Waiting for approval",
    tone: "bg-amber-500/10 text-amber-300 ring-amber-500/20",
  },
  ACTIVE: {
    label: "Live",
    tone: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20",
  },
  PAUSED: {
    label: "Paused",
    tone: "bg-slate-500/10 text-slate-300 ring-slate-500/20",
  },
  REJECTED: {
    label: "Rejected",
    tone: "bg-red-500/10 text-red-300 ring-red-500/20",
  },
  COMPLETED: {
    label: "Finished",
    tone: "bg-indigo-500/10 text-indigo-300 ring-indigo-500/20",
  },
  EXPIRED: {
    label: "Expired",
    tone: "bg-slate-500/10 text-slate-400 ring-slate-500/20",
  },
  ARCHIVED: {
    label: "Archived",
    tone: "bg-slate-500/10 text-slate-400 ring-slate-500/20",
  },
  DRAFT: {
    label: "Draft",
    tone: "bg-slate-500/10 text-slate-400 ring-slate-500/20",
  },
};

export function BuyerHubView({
  cashBalance,
  taskCredit,
  runway,
  pointsPerUsd,
  feePercent,
  canCreate,
  tasks,
  invoices,
  platforms = [],
  canTarget = false,
  minPoints = 1,
  maxPoints = 100000,
  maxCompletions = 100000,
}: {
  cashBalance: number;
  taskCredit: number;
  /**
   * How many more completions the credit covers across live tasks, or null
   * when nothing is live. Null and 0 mean different things and must not be
   * collapsed: "nothing running" is fine, "0 left" is urgent.
   */
  runway: number | null;
  pointsPerUsd: number;
  feePercent: number;
  canCreate: boolean;
  tasks: BuyerTaskRow[];
  invoices: InvoiceRow[];
  /** Platforms this buyer may target — same scoped catalog the create form uses. */
  platforms?: BuyerPlatform[];
  /** Admin-granted `targetTasks` — gates the audience section, same as create. */
  canTarget?: boolean;
  minPoints?: number;
  maxPoints?: number;
  maxCompletions?: number;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"tasks" | "invoices">("tasks");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [proofFor, setProofFor] = useState<string | null>(null);
  const [proof, setProof] = useState<ProofRow[] | null>(null);
  const [proofLoading, setProofLoading] = useState(false);
  const [editingTask, setEditingTask] = useState<BuyerTaskRow | null>(null);

  /** Retire a task for good. Nothing to refund — see the API note. */
  const cancel = async (taskId: string, title: string) => {
    const ok = await confirmDialog({
      title: `Cancel "${title}"?`,
      description:
        "It stops being shown and cannot be restarted. You are only ever charged for completions, so a cancelled task costs you nothing more.",
      tone: "danger",
      confirmLabel: "Cancel the task",
    });
    if (!ok) return;
    setBusyId(taskId);
    try {
      const res = await fetch(`/api/tasks/mine/${taskId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not cancel");
      toast.success("Task cancelled");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not cancel");
    } finally {
      setBusyId(null);
    }
  };

  /** Show a buyer the work they paid for. Read only — see the API note. */
  const openProof = async (taskId: string) => {
    if (proofFor === taskId) {
      setProofFor(null);
      return;
    }
    setProofFor(taskId);
    setProof(null);
    setProofLoading(true);
    try {
      const res = await fetch(`/api/tasks/mine/${taskId}/submissions`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not load the work");
      setProof(data.submissions ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load the work");
      setProofFor(null);
    } finally {
      setProofLoading(false);
    }
  };

  /** Pause or resume one of the buyer's own tasks. */
  const setRunning = async (taskId: string, action: "pause" | "resume") => {
    setBusyId(taskId);
    try {
      const res = await fetch(`/api/tasks/mine/${taskId}/pause`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not update the task");
      toast.success(action === "pause" ? "Task paused" : "Task is live again");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusyId(null);
    }
  };

  const live = tasks.filter((t) => t.status === "ACTIVE").length;
  const awaiting = tasks.filter((t) => t.status === "PENDING_REVIEW").length;
  const delivered = tasks.reduce((s, t) => s + t.approvedCount, 0);
  // Credit SPENT on completions — the reward rows and the fee rows, both
  // stored negative. Deliberately not a dollar figure: nothing is charged in
  // dollars any more, so summing `amountUsd` reported $0.00 and looked broken.
  // Sum every non-purchase row and flip the sign: charges are negative, so
  // this comes out positive, and anything credited BACK nets itself off
  // instead of being ignored. Purchases are excluded because buying credit is
  // not spending it — leaving them in would make the figure go negative.
  const creditSpent = -invoices
    .filter((r) => !r.reference.startsWith("taskcredit_buy_"))
    .reduce((s, r) => s + r.points, 0);

  // What the live tasks still advertise. NOT "held" — nothing is reserved
  // under pay-as-you-go, and calling it held would tell a buyer their credit
  // is committed when it is free to spend anywhere.
  const advertised = tasks
    .filter((t) => t.status === "ACTIVE" || t.status === "PENDING_REVIEW")
    .reduce((s, t) => s + t.remainingBudget, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Buyer Hub</h1>
          <p className="text-sm text-gray-400">
            Your tasks, what they cost, and who has completed them.
          </p>
        </div>
        <div className="flex gap-2">
        <Link
          href="/buy-points"
          className={cn(
            "inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold",
            TASK_CREDIT.chip
          )}
        >
          <Sparkles className="h-4 w-4" />
          Buy credit
        </Link>
        {canCreate && (
          <Link
            href="/create-task"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-600"
          >
            <Plus className="h-4 w-4" />
            New task
          </Link>
        )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          icon={Sparkles}
          label={TASK_CREDIT.label}
          value={pts(taskCredit)}
          sub={
            runway === null
              ? `${usd(taskCredit / (pointsPerUsd || 1000))} · nothing running`
              : `about ${runway.toLocaleString()} more completion${runway === 1 ? "" : "s"}`
          }
          tone={
            runway !== null && runway <= LOW_RUNWAY
              ? "text-amber-400"
              : TASK_CREDIT.text
          }
        />
        <Stat
          icon={ListChecks}
          label="Live tasks"
          value={String(live)}
          sub={awaiting ? `${awaiting} awaiting approval` : "none awaiting"}
        />
        <Stat
          icon={Users}
          label="Completions"
          value={delivered.toLocaleString()}
          sub="approved and paid"
        />
        <Stat
          icon={Receipt}
          label="Credit spent"
          value={pts(creditSpent)}
          sub={
            advertised > 0
              ? `${pts(advertised)} pts still advertised`
              : "nothing running"
          }
        />
      </div>

      {/* Warn BEFORE it runs out. A buyer who finds out at zero has already
          had tasks stop; this is the window where topping up costs them
          nothing but a click. */}
      {runway !== null && runway <= LOW_RUNWAY && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
          <p className="flex-1 text-xs leading-relaxed text-amber-200/90">
            {runway === 0 ? (
              <>
                <span className="font-semibold">
                  Your credit can&rsquo;t cover another completion.
                </span>{" "}
                Live tasks stop as soon as they try to pay someone.
              </>
            ) : (
              <>
                <span className="font-semibold">
                  About {runway} completion{runway === 1 ? "" : "s"} of credit
                  left.
                </span>{" "}
                Your tasks stop when it runs out.
              </>
            )}
            {/* Whether they can act right now, without a second trip. */}
            {cashBalance > 0 ? (
              <>
                {" "}
                Your wallet holds {usd(cashBalance)} — enough for{" "}
                {pts(Math.floor(cashBalance * (pointsPerUsd || 1000)))} more
                credit.
              </>
            ) : (
              <> Your wallet is empty, so top it up first.</>
            )}
          </p>
          <Link
            href="/buy-points"
            className={cn(
              "shrink-0 rounded-lg border px-3 py-1.5 text-xs font-bold",
              TASK_CREDIT.chip
            )}
          >
            Top up
          </Link>
        </div>
      )}

      <div className="flex gap-2 rounded-xl border border-gray-800 bg-gray-950/50 p-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
        <p className="text-[11px] leading-relaxed text-gray-500">
          Submissions are checked automatically and reviewed by our team — you
          are not asked to approve them. That is deliberate: it means nobody can
          refuse work that was done properly, and it means you are never the one
          holding up someone&rsquo;s payment. Something wrong with a submission?
          Contact support and an admin will look at it.
        </p>
      </div>

      <div className="flex gap-1 border-b border-gray-800">
        {(
          [
            ["tasks", `My tasks (${tasks.length})`],
            ["invoices", `Invoices (${invoices.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "-mb-px rounded-t-lg px-4 py-2.5 text-sm font-semibold",
              tab === id
                ? "border-b-2 border-indigo-500 text-white"
                : "text-gray-500 hover:text-gray-300"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "tasks" && (
        <div className="space-y-3">
          {tasks.length === 0 && (
            <Empty
              title="No tasks yet"
              body="When you fund a task it appears here with its progress, its budget, and what you were charged."
            />
          )}
          {tasks.map((t) => {
            const st = STATUS[t.status] ?? {
              label: t.status,
              tone: "bg-slate-500/10 text-slate-300 ring-slate-500/20",
            };
            const pct =
              t.targetCount > 0
                ? Math.min(100, Math.round((t.approvedCount / t.targetCount) * 100))
                : 0;
            const spentPoints = t.budgetPoints - t.remainingBudget;
            return (
              <div
                key={t.id}
                className="glass rounded-xl p-4 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">
                      {t.title}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {t.type} · {t.pointsReward.toLocaleString()} pts each ·{" "}
                      {new Date(t.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1",
                      st.tone
                    )}
                  >
                    {st.label}
                  </span>
                </div>

                {/*
                  The reason an admin gave, shown to the person it was written
                  for. It was stored on the task and never surfaced, so a
                  rejected buyer could only guess what to change.
                */}
                {t.status === "REJECTED" && (
                  <div className="flex gap-2 rounded-lg border border-red-500/25 bg-red-500/10 p-3">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                    <div>
                      <p className="text-xs font-semibold text-red-300">
                        Why this was rejected
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-red-200/80">
                        {t.rejectionReason?.trim() ||
                          "No reason was recorded. Contact support if you need detail."}
                      </p>
                      <p className="mt-1 text-[11px] text-red-200/50">
                        Your unspent budget was refunded to your wallet.
                      </p>
                    </div>
                  </div>
                )}

                {t.status !== "REJECTED" && (
                  <>
                    <div>
                      <div className="mb-1 flex items-baseline justify-between text-xs">
                        <span className="text-gray-400">
                          {t.approvedCount.toLocaleString()} of{" "}
                          {t.targetCount.toLocaleString()} completed
                        </span>
                        <span className="tabular-nums text-gray-500">
                          {pct}%
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-gray-800">
                        <div
                          className="h-full rounded-full bg-indigo-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500">
                      {/* "Still advertised", not "budget left": nothing is
                          reserved against this task, so calling the remainder
                          a budget would suggest the credit is already spoken
                          for when it is free to use anywhere. */}
                      <span>
                        Still advertised{" "}
                        <span className="tabular-nums text-gray-300">
                          {pts(t.remainingBudget)}
                        </span>{" "}
                        of {pts(t.budgetPoints)} pts
                      </span>
                      <span>
                        Paid out{" "}
                        <span className="tabular-nums text-gray-300">
                          {pts(spentPoints)}
                        </span>{" "}
                        pts
                      </span>
                      {t.pendingCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-amber-400/80">
                          <Clock className="h-3 w-3" />
                          {t.pendingCount} awaiting review
                        </span>
                      )}
                    </div>

                    {/* Stopping a task is the buyer's own call — it is their
                        task and their credit. Judging the WORK is not: that
                        stays with admins and auto-verification. */}
                    {(t.status === "ACTIVE" || t.status === "PAUSED") && (
                      <button
                        type="button"
                        disabled={busyId === t.id}
                        onClick={() =>
                          setRunning(
                            t.id,
                            t.status === "ACTIVE" ? "pause" : "resume"
                          )
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:text-white disabled:opacity-50"
                      >
                        {busyId === t.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : t.status === "ACTIVE" ? (
                          <Pause className="h-3.5 w-3.5" />
                        ) : (
                          <Play className="h-3.5 w-3.5" />
                        )}
                        {t.status === "ACTIVE" ? "Pause task" : "Resume task"}
                      </button>
                    )}

                    {EDITABLE_STATUSES.has(t.status) && (
                      <>
                        <button
                          type="button"
                          disabled={busyId === t.id}
                          onClick={() => setEditingTask(t)}
                          className="ml-2 inline-flex items-center gap-1.5 rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:text-white disabled:opacity-50"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={busyId === t.id}
                          onClick={() => cancel(t.id, t.title)}
                          className="ml-2 inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Cancel
                        </button>
                      </>
                    )}

                    {t.approvedCount > 0 && (
                      <button
                        type="button"
                        onClick={() => openProof(t.id)}
                        className="ml-2 inline-flex items-center gap-1.5 rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:text-white"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        {proofFor === t.id
                          ? "Hide the work"
                          : `See the work (${t.approvedCount})`}
                      </button>
                    )}

                    {proofFor === t.id && (
                      <div className="mt-2 space-y-2 rounded-lg border border-gray-800 bg-gray-950/60 p-3">
                        {proofLoading && (
                          <p className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Loading…
                          </p>
                        )}
                        {!proofLoading && proof && proof.length === 0 && (
                          <p className="text-xs text-gray-500">
                            Nothing approved yet.
                          </p>
                        )}
                        {!proofLoading &&
                          proof?.map((r) => (
                            <div
                              key={r.id}
                              className="rounded-md border border-gray-800 bg-gray-900/60 p-2.5"
                            >
                              <div className="flex items-center justify-between gap-2 text-[11px] text-gray-500">
                                <span>{new Date(r.at).toLocaleString()}</span>
                                <span className={TASK_CREDIT.textStrong}>
                                  −{pts(r.pointsPaid)} pts
                                </span>
                              </div>
                              {r.proof && (
                                <p className="mt-1 wrap-break-word text-xs text-gray-300">
                                  {/^https?:\/\//.test(r.proof.trim()) ? (
                                    <a
                                      href={r.proof.trim()}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300"
                                    >
                                      {r.proof.trim()}
                                      <ExternalLink className="h-3 w-3 shrink-0" />
                                    </a>
                                  ) : (
                                    r.proof
                                  )}
                                </p>
                              )}
                              {r.proofImages.length > 0 && (
                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                  {r.proofImages.map((src) => (
                                    <a
                                      key={src}
                                      href={src}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[11px] text-indigo-400 hover:text-indigo-300"
                                    >
                                      View screenshot
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        <p className="text-[11px] leading-relaxed text-gray-600">
                          Approved work only, and without names — you are seeing
                          what was delivered, not who delivered it.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === "invoices" && (
        <div className="space-y-2">
          {invoices.length === 0 && (
            <Empty
              title="No invoices yet"
              body={
                feePercent > 0
                  ? `Credit you buy, and every completion it pays for — the reward and the ${feePercent}% fee on it.`
                  : "Credit you buy, and every completion it pays for."
              }
            />
          )}
          {invoices.map((r) => {
            const isPurchase = r.reference.startsWith("taskcredit_buy_");
            const isFee = r.reference.startsWith("task_fee_");
            // A credit purchase is the only row where dollars moved; every
            // other row moved credit.
            const incoming = isPurchase ? true : r.points > 0;
            return (
              <div
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-gray-800 bg-gray-950/50 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-gray-200">
                    {r.description || r.reference}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    {new Date(r.createdAt).toLocaleString()}
                    {isFee && " · platform fee"}
                    {isPurchase && ` · +${pts(r.points)} credit`}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 text-sm font-bold tabular-nums",
                    incoming
                      ? "text-emerald-400"
                      : isFee
                        ? "text-gray-400"
                        : TASK_CREDIT.textStrong
                  )}
                >
                  {isPurchase ? (
                    <>
                      −{usd(Math.abs(r.amountUsd))}
                    </>
                  ) : r.points === 0 ? (
                    <span className="text-[11px] font-medium text-gray-600">
                      no charge
                    </span>
                  ) : (
                    <>
                      {r.points > 0 ? "+" : "−"}
                      {pts(Math.abs(r.points))} pts
                    </>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {editingTask && (
        <EditTaskModal
          task={editingTask}
          platforms={platforms}
          canTarget={canTarget}
          minPoints={minPoints}
          maxPoints={maxPoints}
          maxCompletions={maxCompletions}
          onClose={() => setEditingTask(null)}
          onSaved={() => {
            setEditingTask(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

/**
 * The full edit form — title, description, platform/action/link (SOCIAL
 * only), extra instructions, minimum level, reward + completions, and
 * audience targeting when granted. Same fields `/api/tasks/mine/[id]`
 * (PATCH) accepts, and nothing this form offers is something that route
 * would refuse.
 *
 * VIDEO tasks are editable here too, but only their title, description,
 * instructions, min level, reward, completions and audience — the route has
 * no way to change a video's link or watch-time (that lives in
 * `videoConfig`, on the task-creation route only), so those two are
 * deliberately not offered here; showing them would silently do nothing.
 */
function EditTaskModal({
  task,
  platforms,
  canTarget,
  minPoints,
  maxPoints,
  maxCompletions,
  onClose,
  onSaved,
}: {
  task: BuyerTaskRow;
  platforms: BuyerPlatform[];
  canTarget: boolean;
  minPoints: number;
  maxPoints: number;
  maxCompletions: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  // Reward and completion count freeze the moment a task goes live — people
  // picked it up on those terms. Mirrors the server's own `notYetLive` gate
  // so the buyer is never shown an input the API will silently ignore.
  const notYetLive = task.status === "PENDING_REVIEW";
  const isSocial = task.type === "SOCIAL";

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [instructions, setInstructions] = useState(task.instructions ?? "");
  const [socialPlatform, setSocialPlatform] = useState(task.socialPlatform ?? "");
  const [socialAction, setSocialAction] = useState(task.socialAction ?? "");
  const [socialUrl, setSocialUrl] = useState(task.socialUrl ?? "");
  const [minLevel, setMinLevel] = useState(task.minLevel ?? 1);
  const [pointsReward, setPointsReward] = useState(task.pointsReward);
  const [targetCount, setTargetCount] = useState(task.targetCount);
  const [audience, setAudience] = useState<TaskAudienceValue>({
    countries: task.countries ?? [],
    genders: task.genders ?? [],
    minAge: task.minAge ?? null,
    maxAge: task.maxAge ?? null,
    regions: task.regions ?? [],
    divisions: task.divisions ?? [],
    districts: task.districts ?? [],
    subDistricts: task.subDistricts ?? [],
    postalCodes: task.postalCodes ?? [],
  });
  const [saving, setSaving] = useState(false);

  const pickPlatform = (key: string) => {
    setSocialPlatform(key);
    setSocialAction("");
  };
  // A platform the buyer was allowed to pick when the task was created can
  // later be closed globally or blocked on this account. Dropping it from
  // the select would leave the field looking blank on an unchanged task, so
  // the current value stays selectable even if it can no longer be chosen
  // fresh.
  const platformOptions =
    socialPlatform && !platforms.some((p) => p.key === socialPlatform)
      ? [
          {
            key: socialPlatform,
            label: socialPlatform,
            emoji: "🔗",
            actions: socialAction
              ? [{ key: socialAction, label: socialAction }]
              : [],
          },
          ...platforms,
        ]
      : platforms;
  const platformDef = platformOptions.find((p) => p.key === socialPlatform);

  const save = async () => {
    if (!title.trim() || !description.trim()) {
      toast.error("Title and description are required");
      return;
    }
    if (isSocial && (!socialUrl.trim() || !socialAction.trim())) {
      toast.error("Social tasks need an action and a target URL");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim(),
        instructions: instructions.trim() || null,
        minLevel: Math.max(1, Math.floor(minLevel)),
      };
      if (isSocial) {
        body.socialPlatform = socialPlatform.trim() || null;
        body.socialAction = socialAction.trim() || null;
        body.socialUrl = socialUrl.trim() || null;
      }
      // Sent only while still awaiting review — the server ignores these
      // once live, but omitting them entirely avoids a request that reads
      // as though it is trying to change a frozen value.
      if (notYetLive) {
        body.pointsReward = Math.floor(pointsReward);
        body.targetCount = Math.floor(targetCount);
      }
      if (canTarget) {
        body.countries = audience.countries;
        body.genders = audience.genders;
        body.regions = audience.regions;
        body.divisions = audience.divisions;
        body.districts = audience.districts;
        body.subDistricts = audience.subDistricts;
        body.postalCodes = audience.postalCodes;
        body.minAge = audience.minAge;
        body.maxAge = audience.maxAge;
      }
      const res = await fetch(`/api/tasks/mine/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not save");
      toast.success(
        data.backToReview ? "Saved — back in the review queue" : "Saved"
      );
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Edit task" subtitle={task.title} onClose={saving ? undefined : onClose}>
      <div className="space-y-3">
        {!notYetLive && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-300">
            Saving sends this task back for review. It stops being shown to
            workers until an admin approves it again — what was approved has
            to be what people see.
          </p>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-400">
            Title *
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-400">
            Description *
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full resize-none rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
          />
        </div>

        {isSocial && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">
                  Platform *
                </label>
                <select
                  value={socialPlatform}
                  onChange={(e) => pickPlatform(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">Choose…</option>
                  {platformOptions.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.emoji} {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">
                  Action *
                </label>
                <select
                  value={socialAction}
                  onChange={(e) => setSocialAction(e.target.value)}
                  disabled={!platformDef}
                  className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none disabled:opacity-50"
                >
                  <option value="">
                    {platformDef ? "Choose…" : "Pick a platform first"}
                  </option>
                  {platformDef?.actions.map((a) => (
                    <option key={a.key} value={a.key}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">
                Target URL *
              </label>
              <input
                value={socialUrl}
                onChange={(e) => setSocialUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </>
        )}

        {task.type === "VIDEO" && (
          <p className="text-[11px] leading-relaxed text-gray-500">
            The video link and watch time can&rsquo;t be changed here — pause
            this task and create a new one to change either.
          </p>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-400">
            Additional instructions
          </label>
          <textarea
            rows={3}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Optional — extra detail shown alongside the task"
            className="w-full resize-none rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-400">
              Points reward
            </label>
            <input
              type="number"
              min={1}
              value={pointsReward}
              disabled={!notYetLive}
              onChange={(e) => setPointsReward(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none disabled:opacity-50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-400">
              Completions
            </label>
            <input
              type="number"
              min={1}
              value={targetCount}
              disabled={!notYetLive}
              onChange={(e) => setTargetCount(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none disabled:opacity-50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-400">
              Min level
            </label>
            <input
              type="number"
              min={1}
              value={minLevel}
              onChange={(e) => setMinLevel(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>
        {notYetLive ? (
          <p className="text-[11px] text-gray-500">
            Reward: {minPoints.toLocaleString()}–{maxPoints.toLocaleString()}{" "}
            pts · up to {maxCompletions.toLocaleString()} completions
          </p>
        ) : (
          <p className="text-[11px] leading-relaxed text-gray-500">
            Reward and completions are locked once a task is live — people
            picked it up on those terms. Pause it and create a new one to
            change either.
          </p>
        )}

        {canTarget && (
          <div className="space-y-2 border-t border-gray-800 pt-3">
            <h3 className="inline-flex items-center gap-1.5 text-xs font-bold text-white">
              <Target className="h-3.5 w-3.5 text-indigo-400" /> Audience
              targeting
            </h3>
            <TaskAudienceTargeting
              value={audience}
              onChange={(patch) => setAudience((a) => ({ ...a, ...patch }))}
            />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-gray-700 px-3 py-2 text-xs font-semibold text-gray-300 hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-600 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
  tone = "text-indigo-400",
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  sub: string;
  tone?: string;
}) {
  return (
    <div className="glass rounded-xl p-3">
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", tone)} />
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          {label}
        </p>
      </div>
      <p className="mt-1.5 text-lg font-bold tabular-nums text-white">{value}</p>
      <p className="text-[11px] text-gray-500">{sub}</p>
    </div>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-800 p-8 text-center">
      <p className="text-sm font-semibold text-gray-300">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-gray-500">
        {body}
      </p>
    </div>
  );
}
