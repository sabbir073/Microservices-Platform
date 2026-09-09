"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { promptDialog } from "@/lib/confirm";

interface TaskReviewActionsProps {
  taskId: string;
}

/**
 * Reasons an admin actually rejects a buyer's task for.
 *
 * Rejection used to be a `window.prompt` labelled "(optional)", so the usual
 * outcome was an empty reason — and the buyer, who is being refused something
 * they PAID for, got "your task was rejected" and nothing else. They cannot fix
 * what they are not told, so they either re-submit the same thing or leave.
 *
 * These are starting points, not a fixed list: the chosen text lands in an
 * editable box so the admin can say what was actually wrong with this one.
 */
const PRESET_REASONS = [
  "The target link doesn't work or isn't public.",
  "The instructions are unclear — a worker couldn't tell what to do.",
  "The reward is too low for the amount of work involved.",
  "This asks for something we don't allow (personal data, off-platform payment, or account sharing).",
  "The content is adult, political, or otherwise not allowed here.",
  "This looks like a duplicate of a task you already have running.",
];

export function TaskReviewActions({ taskId }: TaskReviewActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [picking, setPicking] = useState(false);

  const review = async (action: "approve" | "reject", reason?: string) => {
    setBusy(action);
    try {
      const res = await fetch(`/api/admin/tasks/${taskId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Failed to ${action} task`);
      toast.success(
        action === "approve" ? "Task approved" : "Task rejected & refunded",
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${action}`);
    } finally {
      setBusy(null);
    }
  };

  /** Preset (or blank) → an editable, REQUIRED box → send. */
  const rejectWith = async (preset: string) => {
    setPicking(false);
    const reason = await promptDialog({
      title: "Reject this task",
      description:
        "The buyer sees this in their Buyer Hub, so write what they need to change. Their budget and any platform fee are refunded either way.",
      tone: "danger",
      multiline: true,
      required: true,
      defaultValue: preset,
      placeholder: "Why this task can't run as submitted…",
      confirmLabel: "Reject & refund",
    });
    if (reason === null) return; // cancelled
    await review("reject", reason.trim());
  };

  return (
    <div className="relative flex items-center gap-2">
      <button
        onClick={() => review("approve")}
        disabled={busy !== null}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-sm font-medium hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
      >
        {busy === "approve" ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Check className="w-4 h-4" />
        )}
        Approve
      </button>
      <button
        onClick={() => setPicking((v) => !v)}
        disabled={busy !== null}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 text-sm font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50"
      >
        {busy === "reject" ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <X className="w-4 h-4" />
        )}
        Reject
      </button>

      {picking && (
        <>
          {/* Click-away. Sits under the panel, over everything else. */}
          <button
            type="button"
            aria-label="Close"
            onClick={() => setPicking(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-slate-700 bg-slate-900 p-2 shadow-xl">
            <p className="px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Pick a reason
            </p>
            {PRESET_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => rejectWith(r)}
                className="block w-full rounded-lg px-2 py-2 text-left text-xs leading-relaxed text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                {r}
              </button>
            ))}
            <button
              type="button"
              onClick={() => rejectWith("")}
              className="mt-1 block w-full rounded-lg border-t border-slate-800 px-2 py-2 text-left text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              Write my own reason…
            </button>
          </div>
        </>
      )}
    </div>
  );
}
