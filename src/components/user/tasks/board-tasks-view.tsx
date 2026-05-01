"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Pin,
  Coins,
  Users,
  Clock,
  ChevronLeft,
  CheckCircle2,
  Circle,
  Lock,
  Trophy,
  Loader2,
  Sparkles,
  Zap,
} from "lucide-react";
import { ListSkeleton } from "@/components/user/primitives/skeleton";
import { EmptyState } from "@/components/user/primitives/empty-state";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Board {
  id: string;
  name: string;
  description?: string;
  thumbnailUrl?: string | null;
  taskCount: number;
  totalRewardPts: number;
  participants: number;
  expiresAt?: string;
}

type TaskUserStatus = "DONE" | "PENDING" | "AVAILABLE";

interface BoardTask {
  id: string;
  title: string;
  type: string;
  pointsReward: number;
  xpReward: number;
  duration?: number | null;
  thumbnailUrl?: string | null;
  userStatus: TaskUserStatus;
}

interface BoardDetail {
  board: {
    id: string;
    title: string;
    description?: string | null;
    iconEmoji?: string | null;
    pointsReward: number;
    xpReward: number;
  };
  tasks: BoardTask[];
  progress: { done: number; total: number; allDone: boolean };
  claimedAt: string | null;
}

const TASK_TYPE_ROUTE: Record<string, string> = {
  ARTICLE: "/article-tasks",
  VIDEO: "/video-tasks",
  QUIZ: "/quiz-tasks",
  SOCIAL: "/social-tasks",
  PROXY: "/proxy-tasks",
  MANUAL: "/manual-tasks",
};

export function BoardTasksView() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [detail, setDetail] = useState<BoardDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    fetch("/api/tasks/boards")
      .then((r) => (r.ok ? r.json() : { boards: [] }))
      .then((d) => setBoards(d.boards ?? []))
      .catch(() => setBoards([]))
      .finally(() => setLoading(false));
  }, []);

  const loadDetail = async (id: string) => {
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await fetch(`/api/tasks/boards/${id}`);
      if (!res.ok) throw new Error(await res.text());
      const d = (await res.json()) as BoardDetail;
      setDetail(d);
    } catch (err) {
      toast.error("Couldn't load board", {
        description: err instanceof Error ? err.message : "Try again",
      });
      setSelectedBoardId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (selectedBoardId) loadDetail(selectedBoardId);
  }, [selectedBoardId]);

  const claim = async () => {
    if (!detail) return;
    setClaiming(true);
    try {
      const res = await fetch(`/api/tasks/boards/${detail.board.id}/claim`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      toast.success(`Board reward claimed! +${data.points} pts, +${data.xp} XP`);
      await loadDetail(detail.board.id);
    } catch (err) {
      toast.error("Claim failed", {
        description: err instanceof Error ? err.message : "Try again",
      });
    } finally {
      setClaiming(false);
    }
  };

  // ───────────────────── Detail view ─────────────────────
  if (selectedBoardId) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => {
            setSelectedBoardId(null);
            setDetail(null);
          }}
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to boards
        </button>

        {detailLoading && <ListSkeleton rows={5} />}

        {!detailLoading && detail && (
          <>
            {/* Header */}
            <div className="rounded-2xl border border-gray-800 bg-linear-to-br from-orange-500/10 via-pink-500/5 to-gray-900 p-4">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center text-2xl shrink-0">
                  {detail.board.iconEmoji || "📌"}
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-lg font-bold text-white">
                    {detail.board.title}
                  </h1>
                  {detail.board.description && (
                    <p className="text-xs text-gray-400 mt-1">
                      {detail.board.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Reward summary */}
              <div className="grid grid-cols-2 gap-2 mt-4">
                <div className="rounded-lg bg-gray-950 border border-gray-800 p-2.5 flex items-center gap-2">
                  <Coins className="w-4 h-4 text-amber-400" />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">
                      Board Reward
                    </p>
                    <p className="text-sm font-bold text-white tabular-nums">
                      {detail.board.pointsReward} pts
                    </p>
                  </div>
                </div>
                <div className="rounded-lg bg-gray-950 border border-gray-800 p-2.5 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-indigo-400" />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">
                      XP
                    </p>
                    <p className="text-sm font-bold text-white tabular-nums">
                      +{detail.board.xpReward}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-300">
                  Progress
                </p>
                <p className="text-xs tabular-nums text-gray-400">
                  {detail.progress.done} / {detail.progress.total} complete
                </p>
              </div>
              <div className="h-2 rounded-full bg-gray-950 overflow-hidden">
                <div
                  className="h-full bg-linear-to-r from-orange-500 to-emerald-500 transition-[width]"
                  style={{
                    width: `${
                      detail.progress.total > 0
                        ? (detail.progress.done / detail.progress.total) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            {/* Task list */}
            {detail.tasks.length === 0 ? (
              <EmptyState
                icon={Pin}
                title="No tasks in this board yet"
                description="Check back soon."
              />
            ) : (
              <div className="space-y-2">
                {detail.tasks.map((t, i) => {
                  const prevDone =
                    i === 0 || detail.tasks[i - 1].userStatus === "DONE";
                  const isLocked =
                    t.userStatus === "AVAILABLE" && !prevDone && i > 0;
                  const route = TASK_TYPE_ROUTE[t.type] ?? "/tasks";
                  return (
                    <div
                      key={t.id}
                      className={cn(
                        "rounded-xl border p-3 flex items-center gap-3 transition-colors",
                        t.userStatus === "DONE"
                          ? "bg-emerald-500/5 border-emerald-500/30"
                          : t.userStatus === "PENDING"
                          ? "bg-amber-500/5 border-amber-500/30"
                          : isLocked
                          ? "bg-gray-950 border-gray-800 opacity-60"
                          : "bg-gray-900 border-gray-800 hover:border-orange-500/40"
                      )}
                    >
                      {/* Status icon */}
                      <div className="shrink-0">
                        {t.userStatus === "DONE" ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        ) : t.userStatus === "PENDING" ? (
                          <Circle className="w-5 h-5 text-amber-400 fill-amber-400/30" />
                        ) : isLocked ? (
                          <Lock className="w-5 h-5 text-gray-600" />
                        ) : (
                          <Circle className="w-5 h-5 text-gray-500" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">
                          {t.title}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          {t.type.toLowerCase()}
                          {t.duration ? ` · ${t.duration} min` : ""}
                          {" · +"}
                          {t.pointsReward} pts
                        </p>
                      </div>

                      {t.userStatus === "DONE" ? (
                        <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-400 shrink-0">
                          Done
                        </span>
                      ) : t.userStatus === "PENDING" ? (
                        <span className="text-[10px] uppercase tracking-wider font-bold text-amber-400 shrink-0">
                          Review
                        </span>
                      ) : isLocked ? (
                        <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500 shrink-0">
                          Locked
                        </span>
                      ) : (
                        <Link
                          href={route}
                          className="px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold shrink-0"
                        >
                          Start →
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Claim CTA */}
            <button
              onClick={claim}
              disabled={
                claiming || !detail.progress.allDone || !!detail.claimedAt
              }
              className={cn(
                "w-full py-3.5 rounded-xl font-bold text-sm inline-flex items-center justify-center gap-2 transition-colors",
                detail.claimedAt
                  ? "bg-gray-800 text-gray-500 cursor-default"
                  : detail.progress.allDone
                  ? "bg-linear-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white"
                  : "bg-gray-800 text-gray-500 cursor-not-allowed"
              )}
            >
              {claiming ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : detail.claimedAt ? (
                <>
                  <Sparkles className="w-4 h-4" />
                  Claimed on {format(new Date(detail.claimedAt), "MMM d")}
                </>
              ) : detail.progress.allDone ? (
                <>
                  <Trophy className="w-4 h-4" />
                  Claim Board Reward (+{detail.board.pointsReward} pts)
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  Complete all tasks to claim
                </>
              )}
            </button>
          </>
        )}
      </div>
    );
  }

  // ───────────────────── List view ─────────────────────
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold text-white flex items-center gap-2">
        📌 Board Tasks
      </h1>

      {loading && <ListSkeleton rows={3} />}

      {!loading && boards.length === 0 && (
        <EmptyState
          icon={Pin}
          title="No active boards"
          description="Boards bundle high-reward tasks into themed challenges."
        />
      )}

      {!loading && boards.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {boards.map((b) => (
            <button
              key={b.id}
              onClick={() => setSelectedBoardId(b.id)}
              className="block text-left rounded-2xl border border-gray-800 bg-gray-900 hover:border-orange-500/40 transition-colors overflow-hidden"
            >
              {b.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={b.thumbnailUrl}
                  alt=""
                  className="w-full h-24 object-cover bg-gray-800"
                />
              ) : (
                <div className="h-24 bg-linear-to-br from-orange-500 to-pink-500 flex items-center justify-center text-3xl">
                  📌
                </div>
              )}
              <div className="p-3">
                <p className="text-sm font-bold text-white line-clamp-1">
                  {b.name}
                </p>
                {b.description && (
                  <p className="text-xs text-gray-400 line-clamp-2 mt-0.5">
                    {b.description}
                  </p>
                )}
                <div className="grid grid-cols-3 gap-1.5 mt-3 text-[10px]">
                  <div className="flex flex-col items-center p-1.5 rounded bg-gray-800">
                    <Pin className="w-3 h-3 text-orange-400 mb-0.5" />
                    <span className="font-bold text-white tabular-nums">
                      {b.taskCount}
                    </span>
                    <span className="text-gray-500">tasks</span>
                  </div>
                  <div className="flex flex-col items-center p-1.5 rounded bg-gray-800">
                    <Coins className="w-3 h-3 text-amber-400 mb-0.5" />
                    <span className="font-bold text-white tabular-nums">
                      {b.totalRewardPts}
                    </span>
                    <span className="text-gray-500">pts</span>
                  </div>
                  <div className="flex flex-col items-center p-1.5 rounded bg-gray-800">
                    <Users className="w-3 h-3 text-indigo-400 mb-0.5" />
                    <span className="font-bold text-white tabular-nums">
                      {b.participants}
                    </span>
                    <span className="text-gray-500">in</span>
                  </div>
                </div>
                {b.expiresAt && (
                  <p className="mt-2 inline-flex items-center gap-1 text-[10px] text-amber-400">
                    <Clock className="w-3 h-3" />
                    Ends {format(new Date(b.expiresAt), "MMM d")}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
