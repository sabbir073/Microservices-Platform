"use client";

import { useEffect, useState } from "react";
import {
  ExternalLink,
  Upload,
  Loader2,
  Filter,
  Sparkles,
  Copy,
  Check,
} from "lucide-react";
import { FilterChips } from "@/components/user/primitives/filter-chips";
import { ListSkeleton } from "@/components/user/primitives/skeleton";
import { EmptyState } from "@/components/user/primitives/empty-state";
import { BottomSheet } from "@/components/user/primitives/bottom-sheet";
import { InlineVideoEmbed } from "@/components/user/primitives/inline-video-embed";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SOCIAL_PLATFORMS, getAction, isWatchAction } from "@/lib/social-tasks";
import { ProofImageUpload } from "@/components/user/tasks/proof-image-upload";
import { SocialWatchModal } from "@/components/user/tasks/social-watch-modal";
import { PlayCircle, CheckCircle2 } from "lucide-react";

type Status =
  | "available"
  | "in_progress"
  | "submitted"
  | "approved"
  | "rejected"
  | "expired";

type ProofRequirements = {
  url: boolean;
  screenshot: boolean;
  username: boolean;
};

interface BundleItemView {
  action: string;
  fields: Record<string, string>;
  points: number;
  proofRequirements: ProofRequirements;
  aiPromptEnabled: boolean;
  aiPrompt?: string | null;
  watchSeconds?: number | null;
  targetUrl: string;
}

/** True when this item uses the timed watch-lock (watch action + duration set). */
function isWatchLocked(item: BundleItemView): boolean {
  return isWatchAction(item.action) && !!item.watchSeconds && item.watchSeconds > 0;
}

interface SocialTask {
  id: string;
  title: string;
  description?: string;
  pointsReward: number;
  difficulty?: string;
  platform: string;
  action: string;
  targetUrl: string;
  items: BundleItemView[];
  instructions?: string | null;
  instructionVideoUrl?: string | null;
}

type ItemProof = { url: string; screenshot: string; username: string };
const EMPTY_PROOF: ItemProof = { url: "", screenshot: "", username: "" };

const PLATFORM_LOOKUP = Object.fromEntries(
  SOCIAL_PLATFORMS.map((p) => [p.key, p])
);

export function SocialTasksView() {
  const [status, setStatus] = useState<Status>("available");
  const [platformFilter, setPlatformFilter] = useState<string>("ALL");
  const [tasks, setTasks] = useState<SocialTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<SocialTask | null>(null);
  // Per-bundle-item proof + AI output, keyed by item index.
  const [proofByIndex, setProofByIndex] = useState<Record<number, ItemProof>>({});
  const [aiOutputByIndex, setAiOutputByIndex] = useState<Record<number, string>>({});
  const [watchedByIndex, setWatchedByIndex] = useState<Record<number, boolean>>({});
  const [watchModal, setWatchModal] = useState<
    { idx: number; url: string; seconds: number; title: string } | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [generatingAi, setGeneratingAi] = useState<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/tasks/social?status=${status}`)
      .then((r) => r.json())
      .then((d) => setTasks(d.tasks ?? []))
      .catch(() => setTasks([]))
      .finally(() => setLoading(false));
  }, [status]);

  const visible = tasks.filter(
    (t) => platformFilter === "ALL" || t.platform === platformFilter
  );

  const startSubmit = (task: SocialTask) => {
    setSubmitting(task);
    setProofByIndex({});
    setAiOutputByIndex({});
    setWatchedByIndex({});
  };

  const setProof = (idx: number, patch: Partial<ItemProof>) => {
    setProofByIndex((prev) => ({
      ...prev,
      [idx]: { ...(prev[idx] ?? EMPTY_PROOF), ...patch },
    }));
  };

  const generateAi = async (idx: number, prompt: string) => {
    setGeneratingAi(idx);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) {
        toast.info("AI not available — write your post manually using the prompt above");
        return;
      }
      const d = await res.json();
      setAiOutputByIndex((prev) => ({ ...prev, [idx]: d.text ?? d.content ?? "" }));
      toast.success("Generated — review and post it");
    } catch {
      toast.info("Use the prompt to write your post manually");
    } finally {
      setGeneratingAi(null);
    }
  };

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // ignore
    }
  };

  const submit = async () => {
    if (!submitting) return;
    const items = submitting.items;
    // Validate every item's required proof before submitting.
    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      const req = item.proofRequirements;
      const p = proofByIndex[idx] ?? EMPTY_PROOF;
      const def = getAction(submitting.platform, item.action);
      const label = def?.label ?? `Action ${idx + 1}`;
      if (isWatchLocked(item) && !watchedByIndex[idx]) {
        toast.error(`${label}: watch to unlock first`);
        return;
      }
      if (req.url && !p.url.trim()) {
        toast.error(`${label}: proof URL is required`);
        return;
      }
      if (req.screenshot && !p.screenshot.trim()) {
        toast.error(`${label}: screenshot is required`);
        return;
      }
      if (req.username && !p.username.trim()) {
        toast.error(`${label}: your username is required`);
        return;
      }
    }
    setBusy(true);
    try {
      const payloadItems = items.map((item, idx) => {
        const req = item.proofRequirements;
        const p = proofByIndex[idx] ?? EMPTY_PROOF;
        const ai = aiOutputByIndex[idx];
        const out: Record<string, string | boolean> = { action: item.action };
        if (req.url) out.proofUrl = p.url;
        if (req.screenshot) out.screenshotUrl = p.screenshot;
        if (req.username) out.username = p.username;
        if (ai && ai.trim()) out.generatedContent = ai;
        if (isWatchLocked(item) && watchedByIndex[idx]) out.watched = true;
        return out;
      });

      const res = await fetch(`/api/tasks/${submitting.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: payloadItems }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Submitted! Awaiting verification.");
      setSubmitting(null);
    } catch (err) {
      toast.error("Failed", {
        description: err instanceof Error ? err.message : "Try again",
      });
    } finally {
      setBusy(false);
    }
  };

  const submittingPlatform = submitting
    ? PLATFORM_LOOKUP[submitting.platform]
    : null;

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold text-white flex items-center gap-2">
        📲 Social Tasks
      </h1>

      <FilterChips
        value={status}
        onChange={setStatus}
        options={[
          { value: "available", label: "Available" },
          { value: "in_progress", label: "In Progress" },
          { value: "submitted", label: "Submitted" },
          { value: "approved", label: "Approved" },
          { value: "rejected", label: "Rejected" },
          { value: "expired", label: "Expired" },
        ]}
      />

      <div className="-mx-4 px-4 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1.5 pb-1 min-w-max">
          <button
            onClick={() => setPlatformFilter("ALL")}
            className={cn(
              "shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold inline-flex items-center gap-1",
              platformFilter === "ALL"
                ? "bg-white text-gray-900"
                : "bg-gray-800 text-gray-400"
            )}
          >
            <Filter className="w-3 h-3" />
            All
          </button>
          {SOCIAL_PLATFORMS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPlatformFilter(p.key)}
              className={cn(
                "shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-opacity",
                platformFilter === p.key
                  ? p.brandColor
                  : "bg-gray-800 text-gray-400 opacity-80"
              )}
            >
              <span className="mr-1">{p.emoji}</span>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <ListSkeleton rows={4} />}

      {!loading && visible.length === 0 && (
        <EmptyState
          icon={ExternalLink}
          title="No social tasks"
          description="Try a different filter or check back later."
        />
      )}

      {!loading &&
        visible.map((t) => {
          const platform = PLATFORM_LOOKUP[t.platform];
          if (!platform) return null;
          const hasAi = t.items.some((it) => it.aiPromptEnabled);
          const openUrl = t.items[0]?.targetUrl || t.targetUrl || platform.websiteUrl;
          return (
            <div
              key={t.id}
              className="rounded-xl border border-gray-800 bg-gray-900 p-3"
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0",
                    platform.brandColor
                  )}
                >
                  {platform.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {t.title}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-indigo-500/15 text-indigo-300">
                      {t.items.length} action{t.items.length > 1 ? "s" : ""}
                    </span>
                    {t.items.slice(0, 3).map((it, i) => {
                      const def = getAction(t.platform, it.action);
                      return (
                        <span
                          key={i}
                          className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-gray-800 text-gray-300"
                        >
                          {def ? `${def.emoji} ${def.label}` : it.action}
                        </span>
                      );
                    })}
                    {t.items.length > 3 && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-gray-800 text-gray-400">
                        +{t.items.length - 3}
                      </span>
                    )}
                    {hasAi && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-purple-500/15 text-purple-400 inline-flex items-center gap-0.5">
                        <Sparkles className="w-2.5 h-2.5" />
                        AI
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-amber-400 font-bold text-sm tabular-nums shrink-0">
                  +{t.pointsReward}
                </span>
              </div>
              <div className="flex gap-2 mt-3">
                <a
                  href={openUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-1 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open {platform.label}
                </a>
                {status === "available" && (
                  <button
                    onClick={() => startSubmit(t)}
                    className="flex-1 inline-flex items-center justify-center gap-1 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-xs font-semibold"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Submit Proof
                  </button>
                )}
              </div>
            </div>
          );
        })}

      <BottomSheet
        open={!!submitting}
        onOpenChange={(o) => !o && setSubmitting(null)}
        title={submitting?.title ?? "Submit Proof"}
        description={
          submittingPlatform
            ? `${submitting?.items.length ?? 0} actions on ${submittingPlatform.label}`
            : undefined
        }
        footer={
          <div className="flex gap-2">
            <button
              disabled={busy}
              onClick={() => setSubmitting(null)}
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
              Submit
            </button>
          </div>
        }
      >
        {submitting && (
          <div className="space-y-4">
            {/* Description / step-by-step instructions (whole task) */}
            {submitting.description && (
              <div className="rounded-lg bg-gray-950 border border-gray-800 p-3">
                <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">
                  About this task
                </p>
                <p className="text-sm text-gray-300">{submitting.description}</p>
              </div>
            )}

            {submitting.instructions && (
              <div className="rounded-lg bg-gray-950 border border-gray-800 p-3">
                <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-2">
                  Steps
                </p>
                <ol className="space-y-1 text-sm text-gray-300 list-decimal pl-4">
                  {submitting.instructions
                    .split("\n")
                    .filter(Boolean)
                    .map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                </ol>
              </div>
            )}

            {submitting.instructionVideoUrl && (
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">
                  Instruction video
                </p>
                <div className="max-w-2xl mx-auto">
                  <InlineVideoEmbed
                    url={submitting.instructionVideoUrl}
                    title={`Instruction video — ${submitting.title}`}
                  />
                </div>
              </div>
            )}

            {/* One block per bundle item, in order */}
            {submitting.items.map((item, idx) => {
              const def = getAction(submitting.platform, item.action);
              const proof = proofByIndex[idx] ?? EMPTY_PROOF;
              const aiOutput = aiOutputByIndex[idx] ?? "";
              const req = item.proofRequirements;
              return (
                <div
                  key={idx}
                  className="rounded-xl border border-gray-800 bg-gray-950 p-3 space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <p className="text-sm font-bold text-white">
                      {def ? `${def.emoji} ${def.label}` : item.action}
                    </p>
                    <span className="ml-auto text-amber-400 font-bold text-xs tabular-nums">
                      +{item.points}
                    </span>
                  </div>

                  {isWatchLocked(item) ? (
                    watchedByIndex[idx] ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Watched
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setWatchModal({
                            idx,
                            url: item.targetUrl,
                            seconds: item.watchSeconds ?? 30,
                            title: def?.label ?? "Watch",
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold"
                      >
                        <PlayCircle className="w-3.5 h-3.5" />
                        Watch {item.watchSeconds}s to unlock
                      </button>
                    )
                  ) : (
                    item.targetUrl && (
                      <a
                        href={item.targetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Open target
                      </a>
                    )
                  )}

                  {/* AI prompt — when admin enabled it for this action */}
                  {item.aiPromptEnabled && item.aiPrompt && (
                    <div className="rounded-lg bg-purple-500/5 border border-purple-500/30 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        <p className="text-sm font-bold text-purple-300">
                          Generate content with AI
                        </p>
                      </div>
                      <div className="rounded bg-gray-950 border border-purple-500/20 p-2 text-xs text-purple-200 whitespace-pre-wrap">
                        {item.aiPrompt}
                      </div>
                      <button
                        type="button"
                        onClick={() => generateAi(idx, item.aiPrompt!)}
                        disabled={generatingAi === idx}
                        className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-xs font-bold disabled:opacity-50"
                      >
                        {generatingAi === idx ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                        Generate with AI
                      </button>
                      {aiOutput && (
                        <div className="rounded bg-gray-950 border border-emerald-500/30 p-2 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold">
                              Generated content
                            </p>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(aiOutput, `ai-${idx}`)}
                              className="inline-flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300"
                            >
                              {copied === `ai-${idx}` ? (
                                <Check className="w-3 h-3" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                              Copy
                            </button>
                          </div>
                          <p className="text-xs text-gray-200 whitespace-pre-wrap">
                            {aiOutput}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Static admin-provided fields (template content to copy) */}
                  {!item.aiPromptEnabled &&
                    def?.adminFields
                      .filter((f) => {
                        if (f.key === "targetUrl" || f.key === "targetHandle")
                          return false;
                        const v = item.fields[f.key];
                        return v && v.trim();
                      })
                      .map((f) => {
                        const v = item.fields[f.key];
                        return (
                          <div
                            key={f.key}
                            className="rounded-lg bg-gray-900 border border-gray-800 p-3 space-y-1.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">
                                {f.label}
                              </p>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(v, `${idx}-${f.key}`)}
                                className="inline-flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300"
                              >
                                {copied === `${idx}-${f.key}` ? (
                                  <Check className="w-3 h-3" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                                Copy
                              </button>
                            </div>
                            <p className="text-xs text-gray-200 whitespace-pre-wrap wrap-break-word">
                              {v}
                            </p>
                          </div>
                        );
                      })}

                  {/* Proof inputs for this action */}
                  <div className="space-y-3 pt-1 border-t border-gray-800">
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">
                      Submit your proof
                    </p>

                    {req.url && (
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">
                          Proof URL <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="url"
                          value={proof.url}
                          onChange={(e) => setProof(idx, { url: e.target.value })}
                          placeholder="https://..."
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                        />
                        <p className="text-[10px] text-gray-500 mt-1">
                          URL of your post / comment / share / profile.
                        </p>
                      </div>
                    )}

                    {req.screenshot && (
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">
                          Screenshot <span className="text-red-400">*</span>
                        </label>
                        <ProofImageUpload
                          value={proof.screenshot}
                          onChange={(url) => setProof(idx, { screenshot: url })}
                        />
                      </div>
                    )}

                    {req.username && (
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">
                          Your {submittingPlatform?.label} username{" "}
                          <span className="text-red-400">*</span>
                        </label>
                        <input
                          value={proof.username}
                          onChange={(e) =>
                            setProof(idx, { username: e.target.value })
                          }
                          placeholder="@yourhandle"
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </BottomSheet>

      {watchModal && (
        <SocialWatchModal
          url={watchModal.url}
          watchSeconds={watchModal.seconds}
          title={watchModal.title}
          onComplete={() =>
            setWatchedByIndex((prev) => ({ ...prev, [watchModal.idx]: true }))
          }
          onClose={() => setWatchModal(null)}
        />
      )}
    </div>
  );
}
