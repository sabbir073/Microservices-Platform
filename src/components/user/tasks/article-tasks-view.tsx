"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { TaskCard } from "@/components/user/primitives/task-card";
import { FilterChips } from "@/components/user/primitives/filter-chips";
import { ListSkeleton } from "@/components/user/primitives/skeleton";
import { EmptyState } from "@/components/user/primitives/empty-state";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type Tab = "available" | "pending" | "approved" | "rejected";

interface ArticleTask {
  id: string;
  title: string;
  description?: string;
  pointsReward: number;
  xpReward: number;
  difficulty?: string;
  thumbnailUrl?: string | null;
  duration?: number | null;
}

interface Submission {
  id: string;
  task: { id: string; title: string };
  status: string;
  pointsReward: number;
  createdAt: string;
  rejectionReason?: string | null;
  adminNote?: string | null;
}

const TAB_TO_STATUS: Record<Tab, string[]> = {
  available: [],
  pending: ["PENDING"],
  approved: ["APPROVED", "AUTO_APPROVED"],
  rejected: ["REJECTED", "REVISION_REQUESTED"],
};

export function ArticleTasksView() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("available");
  const [tasks, setTasks] = useState<ArticleTask[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      if (tab === "available") {
        const res = await fetch("/api/tasks?type=ARTICLE", { cache: "no-store" });
        const d = await res.json();
        setTasks(d.tasks ?? []);
      } else {
        const res = await fetch(
          `/api/submissions?status=${TAB_TO_STATUS[tab].join(",")}&type=ARTICLE`,
          { cache: "no-store" }
        );
        const d = await res.json();
        setSubmissions(d.submissions ?? []);
      }
    } catch {
      // ignore
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useAutoRefresh(() => load(true));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white inline-flex items-center gap-2">
          <FileText className="w-6 h-6 text-blue-400" />
          Article Tasks
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Read articles, submit proof, get rewarded. Submissions go to PENDING
          and get credited when admin approves.
        </p>
      </div>

      <FilterChips
        value={tab}
        onChange={setTab}
        options={[
          { value: "available", label: "Available", count: tasks.length },
          { value: "pending", label: "Pending" },
          { value: "approved", label: "Approved" },
          { value: "rejected", label: "Rejected" },
        ]}
      />

      {loading && <ListSkeleton rows={4} />}

      {!loading && tab === "available" && tasks.length === 0 && (
        <EmptyState
          icon={FileText}
          title="No article tasks available"
          description="Check back soon for new article tasks."
        />
      )}

      {!loading &&
        tab === "available" &&
        tasks.map((t) => (
          <TaskCard
            key={t.id}
            title={t.title}
            description={t.description}
            type="article"
            reward={t.pointsReward}
            xpReward={t.xpReward}
            durationMin={t.duration ?? undefined}
            thumbnail={t.thumbnailUrl ?? undefined}
            actionLabel="Read & Submit"
            onAction={() => router.push(`/article-tasks/${t.id}`)}
          />
        ))}

      {!loading && tab !== "available" && submissions.length === 0 && (
        <EmptyState
          icon={FileText}
          title={`No ${tab} submissions`}
          description={
            tab === "pending"
              ? "Submit an article task to see it here."
              : `Your ${tab} submissions will show up here.`
          }
        />
      )}

      {!loading && tab !== "available" && submissions.length > 0 && (
        <div className="space-y-2">
          {submissions.map((s) => (
            <div
              key={s.id}
              className="p-3 rounded-xl border border-gray-800 bg-gray-900"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {s.task.title}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    {format(new Date(s.createdAt), "PP p")}
                  </p>
                </div>
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[10px] font-bold uppercase",
                    s.status === "PENDING" && "bg-amber-500/10 text-amber-400",
                    (s.status === "APPROVED" ||
                      s.status === "AUTO_APPROVED") &&
                      "bg-emerald-500/10 text-emerald-400",
                    s.status === "REJECTED" && "bg-red-500/10 text-red-400",
                    s.status === "REVISION_REQUESTED" &&
                      "bg-orange-500/10 text-orange-400"
                  )}
                >
                  {s.status.replace("_", " ")}
                </span>
                <span className="text-sm font-bold text-amber-400 tabular-nums">
                  +{s.pointsReward}
                </span>
              </div>
              {(s.rejectionReason || s.adminNote) && (
                <p className="text-xs text-gray-400 mt-1.5 px-2 py-1.5 rounded bg-gray-950">
                  {s.rejectionReason && (
                    <strong>{s.rejectionReason}: </strong>
                  )}
                  {s.adminNote}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
