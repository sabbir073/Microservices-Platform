"use client";

import { useEffect, useRef, useState } from "react";
import { Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";

export interface WithdrawalTickerItem {
  id: string;
  username: string;
  amount: number;
  unit?: "USD" | "pts";
  method?: string | null;
  country?: string | null;
}

interface WithdrawalTickerProps {
  items: WithdrawalTickerItem[];
  className?: string;
  speedSec?: number;
  showAmount?: boolean;
  showMethod?: boolean;
  showCountry?: boolean;
  // Subscribe to a Server-Sent Events stream and prepend new approvals as
  // they arrive. Degrades silently if the browser/server doesn't support it.
  liveStream?: boolean;
  streamUrl?: string;
  maxItems?: number;
}

export function WithdrawalTicker({
  items: initialItems,
  className,
  speedSec = 40,
  showAmount = true,
  showMethod = false,
  showCountry = false,
  liveStream = true,
  streamUrl = "/api/withdrawal-ticker/stream",
  maxItems = 30,
}: WithdrawalTickerProps) {
  const [items, setItems] = useState(initialItems);
  const seenIds = useRef(new Set(initialItems.map((i) => i.id)));

  useEffect(() => {
    if (!liveStream || typeof window === "undefined") return;
    if (typeof EventSource === "undefined") return;

    const es = new EventSource(streamUrl);
    es.addEventListener("withdrawal", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data) as WithdrawalTickerItem;
        if (!data?.id || seenIds.current.has(data.id)) return;
        seenIds.current.add(data.id);
        setItems((prev) => [data, ...prev].slice(0, maxItems));
      } catch {
        // ignore malformed payloads
      }
    });
    es.addEventListener("expired", () => {
      es.close();
    });
    es.onerror = () => {
      // EventSource auto-retries on transient errors; nothing to do.
    };
    return () => {
      es.close();
    };
  }, [liveStream, streamUrl, maxItems]);

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
              {showAmount && (
                <span className="text-emerald-400 font-bold">
                  {it.unit === "pts"
                    ? `${it.amount.toLocaleString()} pts`
                    : `$${it.amount.toFixed(2)}`}
                </span>
              )}
              {showMethod && it.method && (
                <span className="text-gray-400">via {it.method}</span>
              )}
              {showCountry && it.country && (
                <span className="text-gray-400">· {it.country}</span>
              )}
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
