import Link from "next/link";
import { ArrowUpRight, ArrowDownRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatCardTone =
  | "blue"
  | "purple"
  | "green"
  | "indigo"
  | "orange"
  | "amber"
  | "red"
  | "pink"
  | "slate";

const TONE_CLASSES: Record<
  StatCardTone,
  { bg: string; text: string; border: string }
> = {
  blue: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
  purple: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20" },
  green: { bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/20" },
  indigo: { bg: "bg-indigo-500/10", text: "text-indigo-400", border: "border-indigo-500/20" },
  orange: { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/20" },
  amber: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
  red: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20" },
  pink: { bg: "bg-pink-500/10", text: "text-pink-400", border: "border-pink-500/20" },
  slate: { bg: "bg-slate-700/40", text: "text-slate-300", border: "border-slate-700" },
};

interface StatCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  delta?: { value: string; positive?: boolean };
  icon: LucideIcon;
  tone?: StatCardTone;
  href?: string;
}

export function StatCard({
  title,
  value,
  subtext,
  delta,
  icon: Icon,
  tone = "blue",
  href,
}: StatCardProps) {
  const t = TONE_CLASSES[tone];
  const Inner = (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 hover:border-slate-700 transition-colors h-full">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-slate-400 font-medium truncate">{title}</p>
          <p className="text-2xl font-bold text-white mt-1.5 truncate">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          {delta && (
            <div className="flex items-center gap-1 mt-2 text-xs">
              {delta.positive !== false ? (
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5 text-red-400 shrink-0" />
              )}
              <span
                className={cn(
                  "font-medium",
                  delta.positive !== false ? "text-emerald-400" : "text-red-400"
                )}
              >
                {delta.value}
              </span>
              {subtext && (
                <span className="text-slate-500 truncate">{subtext}</span>
              )}
            </div>
          )}
          {!delta && subtext && (
            <p className="text-xs text-slate-500 mt-2 truncate">{subtext}</p>
          )}
        </div>
        <div className={cn("p-2.5 rounded-lg shrink-0", t.bg)}>
          <Icon className={cn("w-5 h-5", t.text)} />
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {Inner}
      </Link>
    );
  }
  return Inner;
}
