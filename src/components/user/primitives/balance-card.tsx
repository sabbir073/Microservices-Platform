import { cn } from "@/lib/utils";
import { Coins, DollarSign, ArrowUpRight } from "lucide-react";
import Link from "next/link";

interface BalanceCardProps {
  points: number;
  cash: number;
  packageTier?: string;
  withdrawHref?: string;
  className?: string;
  compact?: boolean;
}

const PT_TO_USD = 0.001;

export function BalanceCard({
  points,
  cash,
  packageTier,
  withdrawHref = "/withdrawal",
  className,
  compact = false,
}: BalanceCardProps) {
  const ptInUsd = points * PT_TO_USD;
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-gray-800 bg-gradient-to-br from-indigo-600/20 via-purple-600/10 to-gray-900 p-4",
        className
      )}
    >
      <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-10 w-40 h-40 rounded-full bg-purple-500/20 blur-3xl pointer-events-none" />

      <div className="relative flex items-start justify-between mb-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">
            Total Balance
          </p>
          <p className="text-2xl font-extrabold text-white tabular-nums mt-0.5">
            ${(cash + ptInUsd).toFixed(2)}
          </p>
        </div>
        {packageTier && (
          <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-bold uppercase">
            {packageTier}
          </span>
        )}
      </div>

      <div className={cn("relative grid gap-2", compact ? "grid-cols-2" : "grid-cols-2")}>
        <div className="rounded-xl bg-gray-900/60 border border-gray-800 p-3">
          <div className="flex items-center gap-1.5 text-amber-400 mb-1">
            <Coins className="w-3.5 h-3.5" />
            <span className="text-[10px] uppercase tracking-wider font-bold">
              Points
            </span>
          </div>
          <p className="text-lg font-bold text-white tabular-nums">
            {points.toLocaleString()}
          </p>
          <p className="text-[10px] text-gray-500">${ptInUsd.toFixed(2)}</p>
        </div>
        <div className="rounded-xl bg-gray-900/60 border border-gray-800 p-3">
          <div className="flex items-center gap-1.5 text-emerald-400 mb-1">
            <DollarSign className="w-3.5 h-3.5" />
            <span className="text-[10px] uppercase tracking-wider font-bold">
              Cash
            </span>
          </div>
          <p className="text-lg font-bold text-white tabular-nums">
            ${cash.toFixed(2)}
          </p>
          <p className="text-[10px] text-gray-500">Withdrawable</p>
        </div>
      </div>

      {!compact && (
        <Link
          href={withdrawHref}
          className="relative mt-3 w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90 text-white text-sm font-semibold transition-opacity"
        >
          Withdraw <ArrowUpRight className="w-4 h-4" />
        </Link>
      )}
    </div>
  );
}
