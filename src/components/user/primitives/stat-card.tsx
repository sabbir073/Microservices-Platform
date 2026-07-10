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
  blue: "bg-indigo-500/10 text-indigo-400",
  purple: "bg-purple-500/10 text-purple-400",
  amber: "bg-amber-500/10 text-amber-400",
  green: "bg-emerald-500/10 text-emerald-400",
  pink: "bg-pink-500/10 text-pink-400",
  slate: "bg-gray-700/40 text-gray-300",
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
    <div
      className={cn(
        "rounded-xl border border-gray-800 bg-gray-900 p-3",
        className
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <div className={cn("p-2 rounded-lg shrink-0", TONE_CLASSES[tone])}>
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold text-white tabular-nums truncate">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          <p className="text-xs text-gray-500 truncate">{label}</p>
          {hint && <p className="text-[10px] text-gray-600 mt-0.5">{hint}</p>}
        </div>
      </div>
    </div>
  );
}
