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
} from "lucide-react";
import { usd, pts, cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { confirmDialog, promptDialog } from "@/lib/confirm";
import { TASK_CREDIT } from "@/lib/task-credit-theme";

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
}

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
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"tasks" | "invoices">("tasks");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [proofFor, setProofFor] = useState<string | null>(null);
  const [proof, setProof] = useState<ProofRow[] | null>(null);
  const [proofLoading, setProofLoading] = useState(false);

  /**
   * Rename a task in place.
   *
   * A title typo used to mean building the whole task again, and since a buyer
   * could not delete either, it meant asking an admin. Editing the CONTENT of a
   * live task sends it back for review — what an admin approved has to be what
   * users see — and the API says so when it happens.
   */
  const rename = async (taskId: string, current: string) => {
    const title = await promptDialog({
      title: "Rename this task",
      description:
        "Editing a live task sends it back to the review queue, because what was approved has to be what people see.",
      defaultValue: current,
      required: true,
      confirmLabel: "Save",
    });
    if (title === null || title.trim() === current) return;
    setBusyId(taskId);
    try {
      const res = await fetch(`/api/tasks/mine/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not save");
      toast.success(
        data.backToReview ? "Saved — back in the review queue" : "Saved"
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusyId(null);
    }
  };

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

                    {["ACTIVE", "PAUSED", "PENDING_REVIEW"].includes(
                      t.status
                    ) && (
                      <>
                        <button
                          type="button"
                          disabled={busyId === t.id}
                          onClick={() => rename(t.id, t.title)}
                          className="ml-2 inline-flex items-center gap-1.5 rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:text-white disabled:opacity-50"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Rename
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
    </div>
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
