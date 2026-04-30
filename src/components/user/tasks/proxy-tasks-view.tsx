"use client";

import { useEffect, useState } from "react";
import { Globe, Loader2, ShieldCheck } from "lucide-react";
import { ListSkeleton } from "@/components/user/primitives/skeleton";
import { EmptyState } from "@/components/user/primitives/empty-state";
import { BottomSheet } from "@/components/user/primitives/bottom-sheet";
import { toast } from "sonner";

interface ProxyTask {
  id: string;
  title: string;
  description?: string;
  pointsReward: number;
  duration: number;
  country: string;
  serverHost?: string;
  serverPort?: number;
}

export function ProxyTasksView() {
  const [tasks, setTasks] = useState<ProxyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<ProxyTask | null>(null);
  const [connected, setConnected] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    fetch("/api/tasks/proxy")
      .then((r) => (r.ok ? r.json() : { tasks: [] }))
      .then((d) => setTasks(d.tasks ?? []))
      .catch(() => setTasks([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!active || !connected) return;
    if (seconds <= 0) {
      finish();
      return;
    }
    const id = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, connected, seconds]);

  const start = (t: ProxyTask) => {
    setActive(t);
    setSeconds(t.duration * 60);
    setConnected(false);
  };

  const connect = () => {
    setConnected(true);
    toast.success("Proxy connected");
  };

  const finish = async () => {
    if (!active) return;
    setCompleting(true);
    try {
      const res = await fetch(`/api/tasks/${active.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proofUrl: "session-complete" }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success(`Task complete! +${active.pointsReward} pts`);
      setActive(null);
      setConnected(false);
    } catch (err) {
      toast.error("Failed", {
        description: err instanceof Error ? err.message : "Try again",
      });
    } finally {
      setCompleting(false);
    }
  };

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold text-white flex items-center gap-2">
        🔗 Proxy Tasks
      </h1>

      <div className="rounded-xl bg-indigo-500/5 border border-indigo-500/20 p-3 flex items-start gap-2">
        <ShieldCheck className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
        <p className="text-xs text-indigo-300">
          Connect to a proxy server for the listed duration to earn rewards. Your
          IP must remain stable during the session.
        </p>
      </div>

      {loading && <ListSkeleton rows={3} />}

      {!loading && tasks.length === 0 && (
        <EmptyState
          icon={Globe}
          title="No proxy tasks available"
          description="Check back soon."
        />
      )}

      {!loading &&
        tasks.map((t) => (
          <div
            key={t.id}
            className="rounded-xl border border-gray-800 bg-gray-900 p-3"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                <Globe className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {t.title}
                </p>
                <p className="text-[11px] text-gray-500">
                  {t.country} · {t.duration} min session
                </p>
              </div>
              <span className="text-amber-400 font-bold text-sm tabular-nums shrink-0">
                +{t.pointsReward}
              </span>
            </div>
            <button
              onClick={() => start(t)}
              className="mt-3 w-full py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold"
            >
              Connect →
            </button>
          </div>
        ))}

      <BottomSheet
        open={!!active}
        onOpenChange={(o) => {
          if (!o && !connected) setActive(null);
        }}
        title={active?.title ?? "Proxy Session"}
        description={active ? `${active.country} · ${active.duration} min` : undefined}
      >
        {active && (
          <div className="space-y-4 text-center">
            <div className="rounded-2xl bg-gray-800 p-6">
              <p className="text-xs uppercase tracking-wider font-bold text-gray-400">
                Time Remaining
              </p>
              <p className="text-5xl font-extrabold text-white tabular-nums mt-2">
                {mm}:{ss}
              </p>
              <div className="mt-3 h-2 rounded-full bg-gray-900 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-[width]"
                  style={{
                    width: `${
                      ((active.duration * 60 - seconds) /
                        (active.duration * 60)) *
                      100
                    }%`,
                  }}
                />
              </div>
            </div>

            {!connected && (
              <button
                onClick={connect}
                className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold"
              >
                Connect to {active.serverHost ?? "proxy"}
              </button>
            )}

            {connected && (
              <div className="flex items-center justify-center gap-2 text-emerald-400 text-sm font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Connection active
              </div>
            )}

            <button
              onClick={() => {
                if (confirm("Disconnect now? Reward will be forfeited.")) {
                  setActive(null);
                  setConnected(false);
                }
              }}
              disabled={completing}
              className="w-full py-2 rounded-lg bg-gray-800 text-white text-sm font-semibold disabled:opacity-50"
            >
              Disconnect
            </button>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
