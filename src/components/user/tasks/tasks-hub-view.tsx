"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ListTodo,
  Search,
  FileText,
  Video,
  Brain,
  Send,
  ClipboardList,
  Globe,
  Pin,
  Smartphone,
} from "lucide-react";
import { TaskCard } from "@/components/user/primitives/task-card";
import { FilterChips } from "@/components/user/primitives/filter-chips";
import { ListSkeleton } from "@/components/user/primitives/skeleton";
import { EmptyState } from "@/components/user/primitives/empty-state";

interface ApiTask {
  id: string;
  title: string;
  description?: string | null;
  type: string;
  pointsReward: number;
  xpReward: number;
  difficulty?: string | null;
  thumbnailUrl?: string | null;
  duration?: number | null;
  minLevel?: number;
  canStart?: boolean;
  reason?: string | null;
}

const TYPE_TO_ROUTE: Record<string, string> = {
  ARTICLE: "/article-tasks",
  VIDEO: "/video-tasks",
  QUIZ: "/quiz-tasks",
  SOCIAL: "/social-tasks",
  PROXY: "/proxy-tasks",
  MANUAL: "/manual-tasks",
  BOARD: "/board-tasks",
  OFFERWALL: "/earn#offerwall",
  CUSTOM: "/manual-tasks",
};

const QUICK_ACCESS = [
  { name: "Articles", href: "/article-tasks", icon: FileText, gradient: "from-blue-500 to-cyan-500" },
  { name: "Videos", href: "/video-tasks", icon: Video, gradient: "from-rose-500 to-pink-500" },
  { name: "Quizzes", href: "/quiz-tasks", icon: Brain, gradient: "from-emerald-500 to-teal-500" },
  { name: "Social", href: "/social-tasks", icon: Send, gradient: "from-cyan-500 to-blue-600" },
  { name: "Manual", href: "/manual-tasks", icon: ClipboardList, gradient: "from-blue-500 to-indigo-600" },
  { name: "Proxy", href: "/proxy-tasks", icon: Globe, gradient: "from-rose-500 to-red-600" },
  { name: "Boards", href: "/board-tasks", icon: Pin, gradient: "from-orange-500 to-pink-500" },
  { name: "Offerwall", href: "/earn#offerwall", icon: Smartphone, gradient: "from-fuchsia-500 to-pink-600" },
];

const FILTERS = [
  { value: "ALL", label: "All" },
  { value: "ARTICLE", label: "Article" },
  { value: "VIDEO", label: "Video" },
  { value: "QUIZ", label: "Quiz" },
  { value: "SOCIAL", label: "Social" },
  { value: "MANUAL", label: "Manual" },
  { value: "PROXY", label: "Proxy" },
];

export function TasksHubView() {
  const [filter, setFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [tasks, setTasks] = useState<ApiTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    available: 0,
    completedToday: 0,
    pointsEarned: 0,
    xpEarned: 0,
  });

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const url = filter === "ALL" ? "/api/tasks?limit=50" : `/api/tasks?type=${filter}&limit=50`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setTasks(d.tasks ?? []);
        setStats((prev) => ({ ...prev, available: d.tasks?.length ?? 0 }));
      })
      .catch(() => {
        if (!cancelled) setTasks([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filter]);

  // Pull today's submission stats (separate small fetch)
  useEffect(() => {
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.todayStats) return;
        setStats((prev) => ({
          ...prev,
          completedToday: d.todayStats.tasksCompleted ?? 0,
          pointsEarned: d.todayStats.pointsEarned ?? 0,
          xpEarned: d.todayStats.xpEarned ?? 0,
        }));
      })
      .catch(() => {});
  }, []);

  const filtered = search.trim()
    ? tasks.filter(
        (t) =>
          t.title.toLowerCase().includes(search.toLowerCase()) ||
          (t.description ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : tasks;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Tasks</h1>
        <p className="text-gray-400 mt-1">
          Complete tasks to earn points and XP
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <p className="text-sm text-gray-400">Available Tasks</p>
          <p className="text-2xl font-bold text-white mt-1 tabular-nums">
            {stats.available}
          </p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <p className="text-sm text-gray-400">Completed Today</p>
          <p className="text-2xl font-bold text-white mt-1 tabular-nums">
            {stats.completedToday}
          </p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <p className="text-sm text-gray-400">Points Earned</p>
          <p className="text-2xl font-bold text-amber-400 mt-1 tabular-nums">
            {stats.pointsEarned}
          </p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <p className="text-sm text-gray-400">XP Earned</p>
          <p className="text-2xl font-bold text-purple-400 mt-1 tabular-nums">
            {stats.xpEarned}
          </p>
        </div>
      </div>

      <section>
        <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-2 px-1">
          Quick Access
        </p>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {QUICK_ACCESS.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="group flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl bg-gray-900 border border-gray-800 hover:border-gray-700 hover:scale-[1.03] transition-all"
            >
              <div
                className={`w-9 h-9 rounded-lg bg-linear-to-br ${item.gradient} flex items-center justify-center shadow-lg`}
              >
                <item.icon className="w-4 h-4 text-white" />
              </div>
              <span className="text-[10px] text-gray-300 group-hover:text-white text-center leading-tight">
                {item.name}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks..."
            className="w-full pl-10 pr-4 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      <FilterChips
        value={filter}
        onChange={setFilter}
        options={FILTERS}
      />

      {loading && <ListSkeleton rows={4} />}

      {!loading && filtered.length === 0 && (
        <EmptyState
          icon={ListTodo}
          title="No tasks available right now"
          description={
            search
              ? `Nothing matches "${search}"`
              : "Check back soon for new earning opportunities!"
          }
        />
      )}

      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((t) => {
            const route = TYPE_TO_ROUTE[t.type] ?? "/manual-tasks";
            return (
              <TaskCard
                key={t.id}
                title={t.title}
                description={t.description ?? undefined}
                type={t.type.toLowerCase()}
                reward={t.pointsReward}
                xpReward={t.xpReward}
                difficulty={
                  (t.difficulty?.toUpperCase() as "EASY" | "MEDIUM" | "HARD") ??
                  undefined
                }
                durationMin={t.duration ?? undefined}
                thumbnail={t.thumbnailUrl ?? undefined}
                href={route}
                actionLabel="Open"
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
