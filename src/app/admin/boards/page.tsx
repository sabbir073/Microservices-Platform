import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasPermission, type UserRole } from "@/lib/rbac";
import { Layers, Plus } from "lucide-react";
import Link from "next/link";

export default async function TaskBoardsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const adminRole = session.user.role as UserRole | undefined;
  if (!hasPermission(adminRole, "boards.view")) redirect("/admin");

  const canManage = hasPermission(adminRole, "boards.manage");
  const boards = await prisma.taskBoard.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white inline-flex items-center gap-2">
            <Layers className="w-6 h-6 text-purple-400" />
            Task Boards
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Group related tasks into boards with bonus completion rewards.
          </p>
        </div>
        {canManage && (
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" />
            Create Board
          </button>
        )}
      </div>

      {boards.length === 0 ? (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-16 text-center">
          <Layers className="w-12 h-12 mx-auto mb-4 text-slate-600" />
          <h3 className="text-lg font-medium text-white mb-1">No boards yet</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Create curated task collections like &quot;Crypto Challenge&quot; or
            &quot;Beginner Bundle&quot;. Users earn a bonus reward when they
            complete every task in the board.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {boards.map((b) => (
            <div
              key={b.id}
              className={`rounded-xl border p-5 transition-colors ${
                b.isActive
                  ? "border-slate-800 bg-slate-900 hover:border-purple-500/50"
                  : "border-slate-800 bg-slate-900/50 opacity-60"
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                {b.iconEmoji && (
                  <span className="text-2xl">{b.iconEmoji}</span>
                )}
                <h3 className="text-white font-semibold flex-1 truncate">
                  {b.title}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs ${
                    b.isActive
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-slate-700 text-slate-400"
                  }`}
                >
                  {b.isActive ? "ACTIVE" : "OFF"}
                </span>
              </div>
              {b.description && (
                <p className="text-sm text-slate-400 mb-4 line-clamp-2">
                  {b.description}
                </p>
              )}
              <div className="flex items-center justify-between text-sm pt-3 border-t border-slate-800">
                <div>
                  <p className="text-amber-400 font-bold tabular-nums">
                    {b.pointsReward.toLocaleString()} pts
                  </p>
                  {b.xpReward > 0 && (
                    <p className="text-xs text-slate-500">+{b.xpReward} XP</p>
                  )}
                </div>
                <Link
                  href={`/admin/boards/${b.id}`}
                  className="text-xs text-blue-400 hover:underline"
                >
                  Manage tasks →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
