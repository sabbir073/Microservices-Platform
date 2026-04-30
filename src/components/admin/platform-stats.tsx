import { cn } from "@/lib/utils";

interface StatBar {
  label: string;
  /** 0–100 */
  percent: number;
  /** Bar fill colour token. */
  tone?: "blue" | "green" | "purple" | "amber" | "pink";
}

const TONE_BG: Record<NonNullable<StatBar["tone"]>, string> = {
  blue: "bg-blue-500",
  green: "bg-emerald-500",
  purple: "bg-purple-500",
  amber: "bg-amber-500",
  pink: "bg-pink-500",
};

interface PlatformStatsProps {
  bars: StatBar[];
  title?: string;
}

export function PlatformStats({
  bars,
  title = "Platform Stats",
}: PlatformStatsProps) {
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 h-full">
      <h3 className="text-sm font-semibold text-white mb-4">{title}</h3>
      <div className="space-y-4">
        {bars.map((b) => {
          const pct = Math.max(0, Math.min(100, b.percent));
          return (
            <div key={b.label}>
              <div className="flex items-center justify-between mb-1.5 text-xs">
                <span className="text-slate-400">{b.label}</span>
                <span className="text-white font-semibold">
                  {pct.toFixed(0)}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-500",
                    TONE_BG[b.tone ?? "blue"]
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
