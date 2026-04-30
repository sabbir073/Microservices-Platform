"use client";

import { Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";

export interface WithdrawalTickerItem {
  id: string;
  username: string;
  amount: number;
  unit?: "USD" | "pts";
}

interface WithdrawalTickerProps {
  items: WithdrawalTickerItem[];
  className?: string;
  speedSec?: number;
}

export function WithdrawalTicker({
  items,
  className,
  speedSec = 40,
}: WithdrawalTickerProps) {
  if (items.length === 0) return null;
  const doubled = [...items, ...items];

  return (
    <div
      className={cn(
        "relative flex items-center gap-2 overflow-hidden rounded-xl bg-emerald-500/10 border border-emerald-500/20 py-1.5 px-3",
        className
      )}
    >
      <Megaphone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
      <div className="overflow-hidden flex-1 [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
        <div
          className="flex gap-6 whitespace-nowrap will-change-transform"
          style={{
            animation: `wt-scroll ${speedSec}s linear infinite`,
          }}
        >
          {doubled.map((it, i) => (
            <span
              key={`${it.id}-${i}`}
              className="text-xs text-gray-200 inline-flex items-center gap-1"
            >
              <span className="text-emerald-400 font-semibold">
                @{it.username}
              </span>
              withdrew
              <span className="text-emerald-400 font-bold">
                {it.unit === "pts"
                  ? `${it.amount.toLocaleString()} pts`
                  : `$${it.amount.toFixed(2)}`}
              </span>
            </span>
          ))}
        </div>
      </div>
      <style jsx>{`
        @keyframes wt-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
