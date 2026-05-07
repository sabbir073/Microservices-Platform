import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  startedAt: Date | string;
  submittedAt: Date | string;
  /** Required time in seconds. */
  requiredSeconds: number;
  /** Verb used in the label, e.g. "Watched", "Read", "Connected". */
  verb?: string;
  /** Compact chip variant for inline rendering. */
  compact?: boolean;
}

function fmt(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function colorTier(elapsed: number, required: number): "ok" | "warn" | "fail" {
  if (required <= 0) return "ok";
  const ratio = elapsed / required;
  if (ratio >= 1) return "ok";
  if (ratio >= 0.8) return "warn";
  return "fail";
}

const TIER_STYLES = {
  ok: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
  warn: "bg-amber-500/10 border-amber-500/30 text-amber-300",
  fail: "bg-red-500/10 border-red-500/30 text-red-300",
} as const;

export function DurationCard({
  startedAt,
  submittedAt,
  requiredSeconds,
  verb = "Watched",
  compact = false,
}: Props) {
  const start = new Date(startedAt).getTime();
  const end = new Date(submittedAt).getTime();
  const elapsedSec = Math.max(0, Math.floor((end - start) / 1000));
  const tier = colorTier(elapsedSec, requiredSeconds);
  const cls = TIER_STYLES[tier];

  if (compact) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border tabular-nums",
          cls
        )}
        title={`${verb} ${fmt(elapsedSec)} of required ${fmt(requiredSeconds)}`}
      >
        <Clock className="w-3 h-3" />
        {fmt(elapsedSec)} / {fmt(requiredSeconds)}
      </span>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border p-3 inline-flex items-center gap-3",
        cls
      )}
    >
      <Clock className="w-5 h-5 shrink-0" />
      <div>
        <p className="text-[10px] uppercase tracking-wider font-bold opacity-80">
          {verb}
        </p>
        <p className="text-base font-bold tabular-nums">
          {fmt(elapsedSec)}{" "}
          <span className="text-xs opacity-70">/ {fmt(requiredSeconds)} required</span>
        </p>
        {tier === "fail" && (
          <p className="text-[11px] mt-0.5 opacity-90">Below 80% threshold</p>
        )}
        {tier === "warn" && (
          <p className="text-[11px] mt-0.5 opacity-90">Just above 80% threshold</p>
        )}
      </div>
    </div>
  );
}
