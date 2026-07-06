"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  X,
  Loader2,
  Upload,
  KeyRound,
  Sparkles,
  PlayCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { VideoConfig } from "@/lib/video-tasks";
import { formatDuration } from "@/lib/video-tasks";
import { AdRenderer } from "@/components/user/primitives/ad-renderer";

const ReactPlayer = dynamic(() => import("react-player"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center bg-black">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
    </div>
  ),
});

interface PlayerTask {
  id: string;
  title: string;
  pointsReward: number;
  xpReward: number;
  videoConfig?: VideoConfig | null;
  contentUrl?: string | null;
}

interface Props {
  task: PlayerTask;
  submissionId: string;
  onClose: (didSubmit: boolean) => void;
}

type Phase = "warmup" | "watch" | "complete" | "submitted";

export function VideoTaskPlayer({ task, submissionId, onClose }: Props) {
  const cfg = task.videoConfig;
  const watchTarget = cfg?.watchSeconds ?? 30;
  const warmupTarget = cfg?.warmupSeconds ?? 0;
  const autoSubmit = cfg?.autoSubmit ?? true;
  const videoUrl = cfg?.videoUrl || task.contentUrl || "";
  const proofReq = cfg?.proofRequirements ?? {
    screenshot: false,
    uniqueKey: false,
  };

  const [phase, setPhase] = useState<Phase>(
    warmupTarget > 0 ? "warmup" : "watch"
  );
  const [warmupLeft, setWarmupLeft] = useState(warmupTarget);
  const [watched, setWatched] = useState(0);
  const [busy, setBusy] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [uniqueKey, setUniqueKey] = useState("");
  const submittedRef = useRef(false);
  const watchedRef = useRef(0);
  const visibleRef = useRef(true);

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Pause progress while tab hidden
  useEffect(() => {
    const onVis = () => {
      visibleRef.current = !document.hidden;
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Warmup countdown
  useEffect(() => {
    if (phase !== "warmup") return;
    if (warmupLeft <= 0) {
      setPhase("watch");
      return;
    }
    const t = setTimeout(() => {
      setWarmupLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearTimeout(t);
  }, [phase, warmupLeft]);

  // Watch ticker (1s) — pauses when tab hidden
  useEffect(() => {
    if (phase !== "watch") return;
    const id = setInterval(() => {
      if (!visibleRef.current) return;
      const next = Math.min(watchTarget, watchedRef.current + 1);
      watchedRef.current = next;
      setWatched(next);
      if (next >= watchTarget) {
        clearInterval(id);
        setPhase("complete");
      }
    }, 1000);
    return () => clearInterval(id);
  }, [phase, watchTarget]);

  // Auto-submit on complete (if configured & no proof needed)
  const needsProofForm =
    proofReq.screenshot || proofReq.uniqueKey;
  useEffect(() => {
    if (phase !== "complete") return;
    if (!autoSubmit) return;
    if (needsProofForm) return;
    if (submittedRef.current) return;
    void doSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, autoSubmit, needsProofForm]);

  const doSubmit = async () => {
    if (submittedRef.current) return;
    if (proofReq.screenshot && !screenshotUrl.trim()) {
      toast.error("Screenshot URL is required");
      return;
    }
    if (proofReq.uniqueKey && !uniqueKey.trim()) {
      toast.error("Unique key is required");
      return;
    }
    submittedRef.current = true;
    setBusy(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId,
          proof: videoUrl,
          proofImages: screenshotUrl ? [screenshotUrl] : [],
          uniqueKey,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      const status = data?.submission?.status as string | undefined;
      if (status === "REJECTED") {
        toast.error("Submission rejected", {
          description: data?.submission?.rejectionReason ?? undefined,
        });
        // Brief pause so the user sees the toast, then close
        setTimeout(() => onClose(true), 1500);
        return;
      }
      setPhase("submitted");
      toast.success(`+${task.pointsReward} pts!`, {
        description:
          status === "PENDING"
            ? "Submitted for review."
            : "Watched & rewarded.",
      });
      // Auto-close after 2.5s
      setTimeout(() => onClose(true), 2500);
    } catch (err) {
      submittedRef.current = false;
      toast.error("Couldn't submit", {
        description: err instanceof Error ? err.message : "Try again",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = () => {
    if (phase === "submitted") {
      onClose(true);
      return;
    }
    if (phase === "complete" && submittedRef.current) {
      onClose(true);
      return;
    }
    if (
      phase === "warmup" ||
      (phase === "watch" && watched < watchTarget)
    ) {
      const ok = window.confirm(
        "Quit now and lose your progress? You won't earn points."
      );
      if (!ok) return;
    }
    onClose(false);
  };

  const watchPct = useMemo(
    () =>
      watchTarget > 0 ? Math.min(100, (watched / watchTarget) * 100) : 0,
    [watched, watchTarget]
  );

  return (
    <div className="fixed inset-0 z-100 bg-black flex flex-col">
      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-4 py-3 bg-linear-to-b from-black/80 to-transparent">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">
            Video Task
          </p>
          <p className="text-sm text-white font-semibold truncate">
            {task.title}
          </p>
        </div>
        <button
          onClick={handleCancel}
          disabled={busy}
          className="ml-3 p-2 rounded-full bg-gray-900/60 hover:bg-gray-800 text-gray-300 disabled:opacity-50"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Player */}
      <div className="relative flex-1">
        {videoUrl ? (
          <ReactPlayer
            src={videoUrl}
            playing
            controls={false}
            playsInline
            muted={false}
            width="100%"
            height="100%"
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: "#000",
            }}
            config={{
              youtube: {
                disablekb: 1,
                rel: 0,
                fs: 0,
              },
            }}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-gray-400">
            <p>No video URL configured.</p>
          </div>
        )}

        {/* Touch-block overlay — swallows clicks/taps so users can't pause/seek */}
        <div
          className="absolute inset-0 z-10"
          onClick={(e) => e.preventDefault()}
          onTouchStart={(e) => e.preventDefault()}
          onTouchEnd={(e) => e.preventDefault()}
          onContextMenu={(e) => e.preventDefault()}
          style={{ touchAction: "none" }}
        />

        {/* Phase 1: warmup */}
        {phase === "warmup" && (
          <div className="absolute inset-0 z-20 grid place-items-center bg-black/70 pointer-events-none">
            <div className="text-center">
              <p className="text-xs uppercase tracking-widest text-indigo-400 font-bold mb-2">
                Get ready
              </p>
              <p className="text-7xl font-black text-white tabular-nums">
                {warmupLeft}
              </p>
              <p className="text-sm text-gray-400 mt-3">
                Starting in… stay on this screen.
              </p>
            </div>
          </div>
        )}

        {/* Phase 4: submitted overlay */}
        {phase === "submitted" && (
          <div className="absolute inset-0 z-20 grid place-items-center bg-emerald-950/90 pointer-events-none">
            <div className="text-center">
              <Sparkles className="w-12 h-12 text-amber-400 mx-auto mb-3" />
              <p className="text-xs uppercase tracking-widest text-emerald-300 font-bold mb-1">
                Earned
              </p>
              <p className="text-5xl font-black text-white tabular-nums">
                +{task.pointsReward}
              </p>
              <p className="text-sm text-emerald-200 mt-2">points credited</p>
            </div>
          </div>
        )}

        {/* Sponsored slots above and below the video (opt-in; null when no ad) */}
        <div className="absolute top-14 inset-x-0 z-30 px-3 pointer-events-none">
          <div className="pointer-events-auto max-w-md mx-auto">
            <AdRenderer placement="VIDEO_ABOVE" />
          </div>
        </div>
        <div className="absolute bottom-28 inset-x-0 z-30 px-3 pointer-events-none">
          <div className="pointer-events-auto max-w-md mx-auto">
            <AdRenderer placement="VIDEO_BELOW" />
          </div>
        </div>
      </div>

      {/* Bottom HUD */}
      <div className="absolute bottom-0 inset-x-0 z-20 bg-linear-to-t from-black via-black/90 to-transparent px-4 pt-6 pb-4 space-y-3">
        {phase === "watch" && (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-300 inline-flex items-center gap-1.5">
                <PlayCircle className="w-4 h-4 text-indigo-400" />
                Watching
              </span>
              <span className="text-white tabular-nums font-mono">
                {formatDuration(watched)} / {formatDuration(watchTarget)}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
              <div
                className="h-full bg-linear-to-r from-indigo-500 to-purple-500 transition-[width] duration-300"
                style={{ width: `${watchPct}%` }}
              />
            </div>
          </>
        )}

        {phase === "complete" && (
          <div className="space-y-3">
            {needsProofForm && (
              <div className="space-y-2">
                {proofReq.screenshot && (
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">
                      Screenshot URL{" "}
                      <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="url"
                      value={screenshotUrl}
                      onChange={(e) => setScreenshotUrl(e.target.value)}
                      placeholder="https://... (upload to imgur, etc.)"
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                )}
                {proofReq.uniqueKey && (
                  <div>
                    <label className="flex text-xs font-medium text-gray-400 mb-1 items-center gap-1">
                      <KeyRound className="w-3 h-3" />
                      Unique Key <span className="text-red-400">*</span>
                    </label>
                    <input
                      value={uniqueKey}
                      onChange={(e) => setUniqueKey(e.target.value)}
                      placeholder="Enter the key shown in the video"
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-amber-500 font-mono"
                    />
                    {cfg?.uniqueKeyHint && (
                      <p className="text-[11px] text-amber-400/80 mt-1">
                        💡 {cfg.uniqueKeyHint}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {(autoSubmit && !needsProofForm) ? (
              <div className="flex items-center justify-center gap-2 py-2.5 text-emerald-400 text-sm font-semibold">
                <Loader2 className="w-4 h-4 animate-spin" />
                Submitting…
              </div>
            ) : (
              <button
                onClick={doSubmit}
                disabled={busy}
                className="w-full py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                Submit & Claim +{task.pointsReward} pts
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
