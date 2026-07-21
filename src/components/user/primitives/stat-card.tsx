import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon?: React.ReactNode;
  tone?: "blue" | "purple" | "amber" | "green" | "slate" | "pink";
  className?: string;
}

const TONE_CLASSES: Record<NonNullable<StatCardProps["tone"]>, string> = {
  blue: "bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/20",
  purple: "bg-violet-500/10 text-violet-400 ring-1 ring-violet-500/20",
  amber: "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20",
  green: "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20",
  pink: "bg-pink-500/10 text-pink-400 ring-1 ring-pink-500/20",
  slate: "bg-gray-700/40 text-gray-300 ring-1 ring-gray-700",
};

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "blue",
  className,
}: StatCardProps) {
  return (
    <div className={cn("card p-4", className)}>
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <div
            className={cn(
              "grid h-10 w-10 place-items-center rounded-xl shrink-0",
              TONE_CLASSES[tone]
            )}
          >
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xl font-extrabold text-white tabular-nums truncate tracking-tight">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          <p className="text-xs font-medium text-gray-400 truncate">{label}</p>
          {hint && <p className="text-[11px] text-gray-500 mt-0.5">{hint}</p>}
        </div>
      </div>
    </div>
  );
}
