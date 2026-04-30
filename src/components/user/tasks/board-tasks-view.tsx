"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Pin, Coins, Users, Clock } from "lucide-react";
import { ListSkeleton } from "@/components/user/primitives/skeleton";
import { EmptyState } from "@/components/user/primitives/empty-state";
import { format } from "date-fns";

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

export function BoardTasksView() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tasks/boards")
      .then((r) => (r.ok ? r.json() : { boards: [] }))
      .then((d) => setBoards(d.boards ?? []))
      .catch(() => setBoards([]))
      .finally(() => setLoading(false));
  }, []);

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
            <Link
              key={b.id}
              href={`/board-tasks/${b.id}`}
              className="block rounded-2xl border border-gray-800 bg-gray-900 hover:border-orange-500/40 transition-colors overflow-hidden"
            >
              {b.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={b.thumbnailUrl}
                  alt=""
                  className="w-full h-24 object-cover bg-gray-800"
                />
              ) : (
                <div className="h-24 bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center text-3xl">
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
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
