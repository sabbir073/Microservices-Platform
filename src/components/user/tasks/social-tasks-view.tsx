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
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SOCIAL_PLATFORMS, getAction } from "@/lib/social-tasks";

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

interface SocialTask {
  id: string;
  title: string;
  description?: string;
  pointsReward: number;
  difficulty?: string;
  platform: string;
  action: string;
  targetUrl: string;
  proofRequirements: ProofRequirements;
  aiPromptEnabled: boolean;
  aiPrompt?: string | null;
  fields: Record<string, string>;
  instructions?: string | null;
  instructionVideoUrl?: string | null;
}

const PLATFORM_LOOKUP = Object.fromEntries(
  SOCIAL_PLATFORMS.map((p) => [p.key, p])
);

export function SocialTasksView() {
  const [status, setStatus] = useState<Status>("available");
  const [platformFilter, setPlatformFilter] = useState<string>("ALL");
  const [tasks, setTasks] = useState<SocialTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<SocialTask | null>(null);
  const [proofUrl, setProofUrl] = useState("");
  const [proofScreenshot, setProofScreenshot] = useState("");
  const [proofUsername, setProofUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiOutput, setAiOutput] = useState("");
  const [generatingAi, setGeneratingAi] = useState(false);
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
    setProofUrl("");
    setProofScreenshot("");
    setProofUsername("");
    setAiOutput("");
  };

  const generateAi = async () => {
    if (!submitting?.aiPrompt) return;
    setGeneratingAi(true);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: submitting.aiPrompt }),
      });
      if (!res.ok) {
        // Fallback: just show the prompt as-is for the user to write themselves
        toast.info("AI not available — write your post manually using the prompt above");
        return;
      }
      const d = await res.json();
      setAiOutput(d.text ?? d.content ?? "");
      toast.success("Generated — review and post it");
    } catch {
      toast.info("Use the prompt to write your post manually");
    } finally {
      setGeneratingAi(false);
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
    const req = submitting.proofRequirements;
    if (req.url && !proofUrl.trim()) {
      toast.error("Proof URL is required");
      return;
    }
    if (req.screenshot && !proofScreenshot.trim()) {
      toast.error("Screenshot is required");
      return;
    }
    if (req.username && !proofUsername.trim()) {
      toast.error("Your username is required");
      return;
    }
    setBusy(true);
    try {
      const body: Record<string, string> = {};
      if (req.url) body.proofUrl = proofUrl;
      if (req.screenshot) body.screenshotUrl = proofScreenshot;
      if (req.username) body.username = proofUsername;
      if (aiOutput.trim()) body.generatedContent = aiOutput;

      const res = await fetch(`/api/tasks/${submitting.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
  const submittingAction = submitting
    ? getAction(submitting.platform, submitting.action)
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
          const action = getAction(t.platform, t.action);
          if (!platform) return null;
          const proofType = derivedProofType(t.proofRequirements);
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
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-gray-800 text-gray-300">
                      {action ? `${action.emoji} ${action.label}` : t.action}
                    </span>
                    <span
                      className={cn(
                        "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase",
                        PROOF_TONE[proofType]
                      )}
                    >
                      {proofType}
                    </span>
                    {t.aiPromptEnabled && (
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
                  href={t.targetUrl || platform.websiteUrl}
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
          submittingPlatform && submittingAction
            ? `${submittingAction.label} on ${submittingPlatform.label}`
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
        {submitting && submittingAction && (
          <div className="space-y-4">
            {/* Description / step-by-step instructions */}
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
              <a
                href={submitting.instructionVideoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs text-indigo-400 hover:text-indigo-300 underline"
              >
                ▶ Watch instruction video
              </a>
            )}

            {/* AI prompt section — when admin enabled it */}
            {submitting.aiPromptEnabled && submitting.aiPrompt && (
              <div className="rounded-lg bg-purple-500/5 border border-purple-500/30 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <p className="text-sm font-bold text-purple-300">
                    Generate content with AI
                  </p>
                </div>
                <p className="text-xs text-gray-400">
                  The admin gave you this prompt — generate content with it,
                  then post on {submittingPlatform?.label} and submit the URL
                  as proof.
                </p>
                <div className="rounded bg-gray-950 border border-purple-500/20 p-2 text-xs text-purple-200 whitespace-pre-wrap">
                  {submitting.aiPrompt}
                </div>
                <button
                  type="button"
                  onClick={generateAi}
                  disabled={generatingAi}
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-xs font-bold disabled:opacity-50"
                >
                  {generatingAi ? (
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
                        onClick={() => copyToClipboard(aiOutput, "ai")}
                        className="inline-flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300"
                      >
                        {copied === "ai" ? (
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

            {/* Static admin-provided fields (template content for user to copy) */}
            {!submitting.aiPromptEnabled &&
              submittingAction.adminFields
                .filter((f) => {
                  // Only show fields that contain content the user needs (skip target URLs etc., already shown via "Open" button)
                  if (f.key === "targetUrl" || f.key === "targetHandle")
                    return false;
                  const v = submitting.fields[f.key];
                  return v && v.trim();
                })
                .map((f) => {
                  const v = submitting.fields[f.key];
                  return (
                    <div
                      key={f.key}
                      className="rounded-lg bg-gray-950 border border-gray-800 p-3 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">
                          {f.label}
                        </p>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(v, f.key)}
                          className="inline-flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300"
                        >
                          {copied === f.key ? (
                            <Check className="w-3 h-3" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          Copy
                        </button>
                      </div>
                      <p className="text-xs text-gray-200 whitespace-pre-wrap break-words">
                        {v}
                      </p>
                    </div>
                  );
                })}

            {/* Proof submission fields */}
            <div className="space-y-3 pt-1 border-t border-gray-800">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">
                Submit your proof
              </p>

              {submitting.proofRequirements.url && (
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
                  <p className="text-[10px] text-gray-500 mt-1">
                    URL of your post / comment / share / profile.
                  </p>
                </div>
              )}

              {submitting.proofRequirements.screenshot && (
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Screenshot URL <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="url"
                    value={proofScreenshot}
                    onChange={(e) => setProofScreenshot(e.target.value)}
                    placeholder="https://... (upload to imgur, etc.)"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              {submitting.proofRequirements.username && (
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Your {submittingPlatform?.label} username{" "}
                    <span className="text-red-400">*</span>
                  </label>
                  <input
                    value={proofUsername}
                    onChange={(e) => setProofUsername(e.target.value)}
                    placeholder="@yourhandle"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}

const PROOF_TONE: Record<string, string> = {
  URL: "bg-indigo-500/10 text-indigo-400",
  SCREENSHOT: "bg-emerald-500/10 text-emerald-400",
  BOTH: "bg-purple-500/10 text-purple-400",
  USERNAME: "bg-cyan-500/10 text-cyan-400",
  NONE: "bg-gray-700 text-gray-400",
};

function derivedProofType(req: ProofRequirements): string {
  if (req.username) return "USERNAME";
  if (req.url && req.screenshot) return "BOTH";
  if (req.url) return "URL";
  if (req.screenshot) return "SCREENSHOT";
  return "NONE";
}
