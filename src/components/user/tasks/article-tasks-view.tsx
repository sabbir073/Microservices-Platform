"use client";

import { useEffect, useState } from "react";
import {
  FileText,
  ExternalLink,
  Upload,
  Loader2,
  KeyRound,
  Hash,
  Video as VideoIcon,
} from "lucide-react";
import { TaskCard } from "@/components/user/primitives/task-card";
import { FilterChips } from "@/components/user/primitives/filter-chips";
import { ListSkeleton } from "@/components/user/primitives/skeleton";
import { EmptyState } from "@/components/user/primitives/empty-state";
import { BottomSheet } from "@/components/user/primitives/bottom-sheet";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ArticleConfig } from "@/lib/article-tasks";

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
  instructions?: string | null;
  instructionVideoUrl?: string | null;
  articleConfig?: ArticleConfig | null;
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
  const [tab, setTab] = useState<Tab>("available");
  const [tasks, setTasks] = useState<ArticleTask[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<ArticleTask | null>(null);
  const [proofUrl, setProofUrl] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [uniqueKey, setUniqueKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      if (tab === "available") {
        const res = await fetch("/api/tasks?type=ARTICLE");
        const d = await res.json();
        setTasks(d.tasks ?? []);
      } else {
        const res = await fetch(
          `/api/submissions?status=${TAB_TO_STATUS[tab].join(",")}&type=ARTICLE`
        );
        const d = await res.json();
        setSubmissions(d.submissions ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const startTask = async (t: ArticleTask) => {
    // Create a new submission first so server can validate elapsed time
    try {
      const res = await fetch(`/api/tasks/${t.id}/start`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      const d = await res.json();
      setSubmissionId(d.submission?.id ?? null);
      setActive(t);
      setProofUrl("");
      setScreenshotUrl("");
      setUniqueKey("");
    } catch (err) {
      toast.error("Couldn't start task", {
        description: err instanceof Error ? err.message : "Try again",
      });
    }
  };

  const submit = async () => {
    if (!active || !submissionId) return;
    const cfg = active.articleConfig;
    const req = cfg?.proofRequirements;
    if (req?.url && !proofUrl.trim()) {
      toast.error("Proof URL is required");
      return;
    }
    if (req?.screenshot && !screenshotUrl.trim()) {
      toast.error("Screenshot URL is required");
      return;
    }
    if (req?.uniqueKey && !uniqueKey.trim()) {
      toast.error("Unique key is required");
      return;
    }
    setBusy(true);
    try {
      const proofImages = screenshotUrl ? [screenshotUrl] : [];
      const res = await fetch(`/api/tasks/${active.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId,
          proof: proofUrl,
          proofImages,
          uniqueKey,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      toast.success("Submitted! Pending admin review.", {
        description: `You'll get ${active.pointsReward} pts when approved.`,
      });
      setActive(null);
      load();
    } catch (err) {
      toast.error("Failed", {
        description: err instanceof Error ? err.message : "Try again",
      });
    } finally {
      setBusy(false);
    }
  };

  const cfg = active?.articleConfig;
  const req = cfg?.proofRequirements;

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
            onAction={() => startTask(t)}
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

      <BottomSheet
        open={!!active}
        onOpenChange={(o) => !o && setActive(null)}
        title={active?.title ?? "Article Task"}
        description="Read the linked articles, then submit your proof."
        footer={
          <div className="flex gap-2">
            <button
              disabled={busy}
              onClick={() => setActive(null)}
              className="flex-1 py-2.5 rounded-lg bg-gray-800 text-white text-sm font-semibold disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              disabled={busy}
              onClick={submit}
              className="flex-1 py-2.5 rounded-lg bg-indigo-500 text-white text-sm font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              Submit for Review
            </button>
          </div>
        }
      >
        {active && (
          <div className="space-y-4">
            {/* Description */}
            {active.description && (
              <div className="rounded-lg bg-gray-950 border border-gray-800 p-3">
                <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">
                  About
                </p>
                <p className="text-sm text-gray-300">{active.description}</p>
              </div>
            )}

            {/* Instructions */}
            {active.instructions && (
              <div className="rounded-lg bg-gray-950 border border-gray-800 p-3">
                <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-2">
                  Steps
                </p>
                <ol className="space-y-1 text-sm text-gray-300 list-decimal pl-4">
                  {active.instructions
                    .split("\n")
                    .filter(Boolean)
                    .map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                </ol>
              </div>
            )}

            {active.instructionVideoUrl && (
              <a
                href={active.instructionVideoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 underline"
              >
                <VideoIcon className="w-3.5 h-3.5" />
                Watch instruction video
              </a>
            )}

            {/* Article links */}
            {cfg && cfg.links.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">
                  Article Links
                </p>
                <div className="space-y-1.5">
                  {cfg.links.map((link, i) => (
                    <a
                      key={i}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-950 border border-gray-800 hover:border-indigo-500/40 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">
                          {link.label || `Link ${i + 1}`}
                        </p>
                        <p className="text-[10px] text-gray-500 font-mono truncate">
                          {link.url}
                        </p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Keywords */}
            {cfg && cfg.keywords.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1.5 inline-flex items-center gap-1">
                  <Hash className="w-3 h-3" />
                  Keywords
                </p>
                <div className="flex flex-wrap gap-1">
                  {cfg.keywords.map((k) => (
                    <span
                      key={k}
                      className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[11px] font-medium border border-amber-500/30"
                    >
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Proof submission */}
            <div className="space-y-3 pt-2 border-t border-gray-800">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">
                Submit your proof
              </p>

              {req?.url && (
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Proof URL <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="url"
                    value={proofUrl}
                    onChange={(e) => setProofUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              {req?.screenshot && (
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Screenshot URL <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="url"
                    value={screenshotUrl}
                    onChange={(e) => setScreenshotUrl(e.target.value)}
                    placeholder="https://... (upload to imgur, etc.)"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              {req?.uniqueKey && (
                <div>
                  <label className="flex text-xs font-medium text-gray-400 mb-1.5 items-center gap-1">
                    <KeyRound className="w-3 h-3" />
                    Unique Key <span className="text-red-400">*</span>
                  </label>
                  <input
                    value={uniqueKey}
                    onChange={(e) => setUniqueKey(e.target.value)}
                    placeholder="Enter the key you found"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-amber-500 font-mono"
                  />
                  {cfg?.uniqueKeyHint && (
                    <p className="text-[11px] text-amber-400/80 mt-1">
                      💡 {cfg.uniqueKeyHint}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
