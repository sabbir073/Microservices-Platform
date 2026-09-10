"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Send,
  Share2,
  Sparkles,
  Wallet,
  Target,
  PlayCircle,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { usd, pts, cn } from "@/lib/utils";
import Link from "next/link";
import { TASK_CREDIT } from "@/lib/task-credit-theme";
import { quoteTask } from "@/lib/buyer-quote";
import {
  TaskAudienceTargeting,
  type TaskAudienceValue,
} from "@/components/admin/tasks/task-audience-targeting";

type TaskType = "SOCIAL" | "VIDEO" | "CUSTOM";

const EMPTY_AUDIENCE: TaskAudienceValue = {
  countries: [],
  genders: [],
  minAge: null,
  maxAge: null,
  regions: [],
  divisions: [],
  districts: [],
  subDistricts: [],
  postalCodes: [],
};

export function CreateTaskView({
  pointsPerUsd,
  canTarget = false,
  feePercent = 0,
  minPoints = 1,
  maxPoints = 100000,
  maxCompletions = 100000,
  allowedTypes = ["SOCIAL", "CUSTOM"],
  needsReview = true,
  taskCredit = 0,
}: {
  pointsPerUsd?: number;
  /** When true, the user may set audience targeting (admin-granted `targetTasks`). */
  canTarget?: boolean;
  /** Platform commission, from the admin Buyer & Task Funding settings. */
  feePercent?: number;
  minPoints?: number;
  maxPoints?: number;
  maxCompletions?: number;
  allowedTypes?: string[];
  /** False when the admin publishes buyer tasks without review. */
  needsReview?: boolean;
  /** The buyer's task-credit balance, in points. This is what funds the task. */
  taskCredit?: number;
}) {
  const router = useRouter();
  const [type, setType] = useState<TaskType>(
    allowedTypes.includes("SOCIAL") ? "SOCIAL" : "CUSTOM"
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  // SOCIAL
  const [socialPlatform, setSocialPlatform] = useState("");
  const [socialAction, setSocialAction] = useState("");
  const [socialUrl, setSocialUrl] = useState("");
  // VIDEO
  const [videoUrl, setVideoUrl] = useState("");
  const [watchSeconds, setWatchSeconds] = useState(30);
  // CUSTOM
  const [instructions, setInstructions] = useState("");
  // Rewards
  const [pointsReward, setPointsReward] = useState(50);
  const [targetCount, setTargetCount] = useState(10);
  const [minLevel, setMinLevel] = useState(1);
  const [audience, setAudience] = useState<TaskAudienceValue>(EMPTY_AUDIENCE);
  const [busy, setBusy] = useState(false);

  // The SAME function the server prices the charge with, so the number on this
  // screen and the number debited cannot drift apart.
  const quote = quoteTask({
    pointsPerCompletion: pointsReward,
    completions: targetCount,
    pointsPerUsd: pointsPerUsd || 1000,
    feePercent,
  });
  const budget = quote.budgetPoints;

  // Admin bounds, surfaced before submit rather than as a server rejection.
  // What one completion costs — reward plus its share of the fee. This is the
  // real gate: a task is publishable when the buyer can pay for one, because
  // credit is charged per completion rather than reserved for all of them.
  const perCompletion =
    pointsReward +
    (feePercent > 0 ? Math.ceil((pointsReward * feePercent) / 100) : 0);
  const shortBy = Math.max(0, perCompletion - taskCredit);
  const limitError =
    pointsReward < minPoints
      ? `Minimum reward is ${minPoints.toLocaleString()} points per completion.`
      : pointsReward > maxPoints
        ? `Maximum reward is ${maxPoints.toLocaleString()} points per completion.`
        : targetCount > maxCompletions
          ? `One task can be funded for at most ${maxCompletions.toLocaleString()} completions.`
          : null;

  const submit = async () => {
    if (!title.trim() || !description.trim()) {
      toast.error("Title and description required");
      return;
    }
    if (pointsReward < 1 || targetCount < 1) {
      toast.error("Reward and target count must be at least 1");
      return;
    }
    if (type === "VIDEO" && !videoUrl.trim()) {
      toast.error("Add the link to your video");
      return;
    }
    if (type === "SOCIAL" && (!socialUrl.trim() || !socialAction.trim())) {
      toast.error("Social tasks need an action and a target URL");
      return;
    }

    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim(),
        type,
        pointsReward: Math.floor(pointsReward),
        targetCount: Math.floor(targetCount),
        minLevel: Math.max(1, Math.floor(minLevel)),
      };
      if (type === "VIDEO") {
        body.videoUrl = videoUrl.trim();
        body.watchSeconds = Math.max(5, Math.floor(watchSeconds));
      }
      if (type === "SOCIAL") {
        body.socialPlatform = socialPlatform.trim() || undefined;
        body.socialAction = socialAction.trim();
        body.socialUrl = socialUrl.trim();
      } else {
        body.instructions = instructions.trim() || undefined;
      }
      if (canTarget) {
        body.countries = audience.countries;
        body.genders = audience.genders;
        body.regions = audience.regions;
        body.divisions = audience.divisions;
        body.districts = audience.districts;
        body.subDistricts = audience.subDistricts;
        body.postalCodes = audience.postalCodes;
        body.minAge = audience.minAge;
        body.maxAge = audience.maxAge;
      }

      const res = await fetch("/api/tasks/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.status === 402) {
        const d = await res.json().catch(() => ({}));
        toast.error("Insufficient wallet funds", {
          description:
            d?.error ||
            (typeof d?.shortBy === "number"
              ? `You're short by ${d.shortBy} points.`
              : "Top up your wallet and try again."),
        });
        return;
      }
      if (res.status === 403) {
        toast.error("Creating tasks isn't available on your plan");
        return;
      }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || "Failed to submit task");
      }

      toast.success("Task submitted for review");
      router.push("/tasks");
    } catch (err) {
      toast.error("Failed", {
        description: err instanceof Error ? err.message : "Try again",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xl font-bold text-white">Create Task</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Fund a task from your wallet. It goes live after admin review.
        </p>
      </div>

      {/* Type toggle. Only the types the admin allows buyers to create — an
          option that the API will refuse is worse than no option. */}
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            { value: "SOCIAL", label: "Social", icon: Share2 },
            { value: "VIDEO", label: "Video", icon: PlayCircle },
            { value: "CUSTOM", label: "Custom", icon: Sparkles },
          ] as const
        )
          .filter((opt) => allowedTypes.includes(opt.value))
          .map((opt) => {
          const Icon = opt.icon;
          const active = type === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setType(opt.value)}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                active
                  ? "border-indigo-500 bg-indigo-500/10 text-indigo-300"
                  : "border-gray-700 bg-gray-950 text-gray-400 hover:border-gray-600"
              }`}
            >
              <Icon className="w-4 h-4" />
              {opt.label}
            </button>
          );
        })}
      </div>

      <div className="glass rounded-xl p-4 space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">
            Title *
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="What should people do?"
            className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">
            Description *
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the task for participants..."
            className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none"
          />
        </div>

        {type === "VIDEO" ? (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">
                Video link
              </label>
              <input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=…"
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-gray-500">
                YouTube, Facebook, Vimeo or a direct video file.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">
                How long must they watch? (seconds)
              </label>
              <input
                type="number"
                min={5}
                max={3600}
                value={watchSeconds}
                onChange={(e) =>
                  setWatchSeconds(parseInt(e.target.value) || 30)
                }
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
              />
              <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
                Watch time is counted on our server while the video is actually
                playing and in view — it is not something the viewer can claim.
              </p>
            </div>
          </div>
        ) : type === "SOCIAL" ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Platform
                </label>
                <input
                  value={socialPlatform}
                  onChange={(e) => setSocialPlatform(e.target.value)}
                  placeholder="e.g. YouTube, Instagram"
                  className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Action *
                </label>
                <input
                  value={socialAction}
                  onChange={(e) => setSocialAction(e.target.value)}
                  placeholder="Follow / Like / Subscribe"
                  className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Target URL *
              </label>
              <input
                value={socialUrl}
                onChange={(e) => setSocialUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </>
        ) : (
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Instructions
            </label>
            <textarea
              rows={4}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Step-by-step instructions for completing this task..."
              className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Points reward
            </label>
            <input
              type="number"
              min={1}
              step={1}
              value={pointsReward}
              onChange={(e) => setPointsReward(Number(e.target.value))}
              className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Completions
            </label>
            <input
              type="number"
              min={1}
              step={1}
              value={targetCount}
              onChange={(e) => setTargetCount(Number(e.target.value))}
              className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500"
            />
            <p className="text-[10px] text-gray-500 mt-1">
              How many completions to fund
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Min level
            </label>
            <input
              type="number"
              min={1}
              step={1}
              value={minLevel}
              onChange={(e) => setMinLevel(Number(e.target.value))}
              className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Audience targeting — only when admin-granted */}
      {canTarget && (
        <div className="glass rounded-xl p-4 space-y-3">
          <div>
            <h2 className="text-sm font-bold text-white inline-flex items-center gap-1.5">
              <Target className="w-4 h-4 text-indigo-400" /> Audience targeting
            </h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Optional. Limit who can do this task by country / area, gender and
              age. Leave empty to reach everyone.
            </p>
          </div>
          <TaskAudienceTargeting value={audience} onChange={(patch) => setAudience((a) => ({ ...a, ...patch }))} />
        </div>
      )}

      {/* Invoice — what this task costs, itemised before you commit to it. */}
      <div className="glass rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 ring-1 ring-indigo-500/20 flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">If everyone completes it</p>
            <p className="text-[11px] text-gray-500">
              {pointsReward.toLocaleString()} pts ×{" "}
              {targetCount.toLocaleString()} completions
            </p>
          </div>
        </div>

        {/* Priced in POINTS, because task credit is what actually pays for
            this. The dollar value trails as a reference so the buyer can still
            see what it is worth. */}
        <div className="mt-3 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Reward pool</span>
            <span className="tabular-nums text-gray-200">
              {pts(budget)} pts
            </span>
          </div>
          {feePercent > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-400">Platform fee ({feePercent}%)</span>
              <span className="tabular-nums text-gray-200">
                {pts(quote.feePoints)} pts
              </span>
            </div>
          )}
          <div className="flex justify-between border-t border-white/10 pt-1.5 font-bold">
            <span className="text-white">Most it can cost</span>
            <span className={cn("tabular-nums", TASK_CREDIT.textStrong)}>
              {pts(quote.totalPoints)} pts
            </span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-gray-500">Worth about</span>
            <span className="tabular-nums text-gray-500">
              {usd(quote.totalUsd)}
            </span>
          </div>
        </div>

        {/* Balance after, so a buyer knows whether they can run this at all
            before writing the whole thing. */}
        <div
          className={cn(
            "mt-3 flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs",
            shortBy > 0
              ? "border-amber-500/30 bg-amber-500/10"
              : cn(TASK_CREDIT.border, TASK_CREDIT.bg)
          )}
        >
          <span className={shortBy > 0 ? "text-amber-300" : "text-gray-400"}>
            {shortBy > 0
              ? `You need at least ${pts(shortBy)} more credit to publish this`
              : `Your credit: ${pts(taskCredit)} — enough for ${Math.floor(
                  taskCredit / Math.max(1, perCompletion)
                ).toLocaleString()} completion${
                  Math.floor(taskCredit / Math.max(1, perCompletion)) === 1
                    ? ""
                    : "s"
                }`}
          </span>
          {shortBy > 0 && (
            <Link
              href="/buy-points"
              className="shrink-0 rounded-md border border-amber-400/40 bg-amber-400/15 px-2 py-1 font-semibold text-amber-200 hover:bg-amber-400/25"
            >
              Buy credit
            </Link>
          )}
        </div>

        <div className="mt-3 space-y-1 border-t border-white/10 pt-2 text-[11px] leading-relaxed text-gray-500">
          <p>
            <span className="font-semibold text-gray-300">
              Nothing is charged now.
            </span>{" "}
            Credit comes out as people complete the task —{" "}
            {pts(pointsReward)} pts each
            {feePercent > 0 ? ` plus ${feePercent}% fee` : ""}. If 10 of{" "}
            {targetCount.toLocaleString()} complete it, you pay for 10.
          </p>
          <p>
            The task switches itself off as soon as your credit can&rsquo;t
            cover one more completion, so nobody works for a reward you
            can&rsquo;t pay.
          </p>
          <p>
            {needsReview
              ? "An admin reviews it before it goes live. A rejected task costs you nothing."
              : "It goes live immediately. A task that is later rejected costs you nothing."}
          </p>
        </div>
      </div>

      {limitError && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          {limitError}
        </p>
      )}

      <button
        onClick={submit}
        disabled={busy || !!limitError || shortBy > 0}
        className="w-full py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Send className="w-4 h-4" />
        )}
        {needsReview ? "Submit for review" : "Publish task"}
      </button>
    </div>
  );
}
