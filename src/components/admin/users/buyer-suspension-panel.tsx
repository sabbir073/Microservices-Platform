"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Ban, RotateCcw } from "lucide-react";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { BUYER_TASK_TYPES } from "@/lib/buyer-task-types";

/**
 * Suspend one task type or one platform for one buyer.
 *
 * The point of the granularity: a buyer who keeps posting rubbish on Pinterest
 * used to leave two options — put up with it, or revoke task creation and lose
 * the customer entirely. Taking Pinterest away is proportionate, and everything
 * else they run keeps working.
 *
 * The note is required by the API and is shown to the buyer. Somebody who is
 * not told what they did wrong cannot stop doing it.
 */
export function BuyerSuspensionPanel({
  userId,
  platforms,
  initialTypes,
  initialPlatforms,
  initialNote,
}: {
  userId: string;
  /** Every platform in the catalog: key + label. */
  platforms: { key: string; label: string; emoji: string }[];
  initialTypes: string[];
  initialPlatforms: string[];
  initialNote: string;
}) {
  const router = useRouter();
  const [types, setTypes] = useState<string[]>(initialTypes);
  const [blocked, setBlocked] = useState<string[]>(initialPlatforms);
  const [note, setNote] = useState(initialNote);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");

  const toggle = (list: string[], set: (v: string[]) => void, key: string) =>
    set(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);

  const anything = types.length > 0 || blocked.length > 0;

  const save = async (clear = false) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/buyer-blocks`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          clear
            ? { types: [], platforms: [], note: "" }
            : { types, platforms: blocked, note }
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not save");
      if (clear) {
        setTypes([]);
        setBlocked([]);
        setNote("");
      }
      toast.success(clear ? "Suspensions cleared" : "Saved");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const shown = search.trim()
    ? platforms.filter((p) =>
        p.label.toLowerCase().includes(search.trim().toLowerCase())
      )
    : platforms;

  return (
    <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Buyer suspensions
        </p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
          Turn off one task type or one platform for this buyer only. Everything
          not ticked stays available. This is separate from the global Buyer
          settings, which decide what buyers get in general.
        </p>
      </div>

      <div>
        <p className="mb-1.5 text-[11px] font-semibold text-slate-500">
          Task types
        </p>
        <div className="flex flex-wrap gap-1.5">
          {BUYER_TASK_TYPES.map((t) => {
            const on = types.includes(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggle(types, setTypes, t)}
                className={cn(
                  "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                  on
                    ? "border-red-500/50 bg-red-500/15 text-red-300"
                    : "border-slate-700 text-slate-400 hover:text-white"
                )}
              >
                {on && <Ban className="mr-1 inline h-3 w-3" />}
                {t}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold text-slate-500">
            Platforms{" "}
            {blocked.length > 0 && (
              <span className="text-red-400">({blocked.length} blocked)</span>
            )}
          </p>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="w-32 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-white focus:border-indigo-500 focus:outline-none"
          />
        </div>
        {/* 40 platforms is too many to scan without a cap; the search is what
            makes a specific one findable. */}
        <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
          {shown.map((p) => {
            const on = blocked.includes(p.key);
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => toggle(blocked, setBlocked, p.key)}
                className={cn(
                  "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                  on
                    ? "border-red-500/50 bg-red-500/15 text-red-300"
                    : "border-slate-700 text-slate-400 hover:text-white"
                )}
              >
                {on && <Ban className="mr-1 inline h-3 w-3" />}
                {p.emoji} {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-1 text-[11px] font-semibold text-slate-500">
          Reason — the buyer sees this
        </p>
        <textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. repeated low-quality Pinterest submissions"
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => save(false)}
          disabled={busy || (anything && note.trim().length < 5)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/15 px-3 py-1.5 text-xs font-bold text-red-300 hover:bg-red-500/25 disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Ban className="h-3.5 w-3.5" />
          )}
          Save suspensions
        </button>
        {(initialTypes.length > 0 || initialPlatforms.length > 0) && (
          <button
            type="button"
            onClick={() => save(true)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Lift everything
          </button>
        )}
      </div>
      {anything && note.trim().length < 5 && (
        <p className="text-[11px] text-amber-400">
          A reason is required — it is what the buyer is shown.
        </p>
      )}
    </div>
  );
}
