"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "@/lib/toast";

/**
 * Closing a buyer's report on one completion.
 *
 * Two buttons and a note, because there are only two answers: the work was bad
 * or it was not. Neither moves money — an approved submission stays approved
 * and the worker stays paid, which the buyer was told before they reported it.
 * What upholding buys is the record on the worker's account, where a pattern
 * can actually be acted on.
 */
export function BuyerReportActions({ submissionId }: { submissionId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const resolve = async (outcome: "UPHELD" | "DISMISSED") => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/buyer-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId, outcome, note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not save that");
      toast.success(
        outcome === "UPHELD" ? "Marked as a bad completion" : "Report dismissed"
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note (kept on the record)"
        className="min-w-0 flex-1 rounded-lg border border-gray-700 bg-gray-950 px-2.5 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => resolve("UPHELD")}
        className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-bold text-red-300 hover:bg-red-500/10 disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ThumbsDown className="h-3.5 w-3.5" />
        )}
        Bad completion
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => resolve("DISMISSED")}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-bold text-gray-300 hover:text-white disabled:opacity-50"
      >
        <ThumbsUp className="h-3.5 w-3.5" />
        Work was fine
      </button>
    </div>
  );
}
