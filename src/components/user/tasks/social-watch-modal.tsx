"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { X, Loader2, PlayCircle, CheckCircle2 } from "lucide-react";
import { formatDuration } from "@/lib/video-tasks";

const ReactPlayer = dynamic(() => import("react-player"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center bg-black">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
    </div>
  ),
});

interface Props {
  url: string;
  watchSeconds: number;
  title?: string;
  onComplete: () => void;
  onClose: () => void;
}

type Phase = "warmup" | "watch" | "complete";

const WARMUP = 3;

/**
 * Fullscreen locked watch player for social WATCH/stream actions. Counts up to
 * `watchSeconds` (pausing when the tab is hidden), blocks pause/seek, then calls
 * `onComplete()`. Adapted from VideoTaskPlayer but with no submit of its own —
 * the parent bundle flow records the item as watched.
 */
export function SocialWatchModal({
  url,
  watchSeconds,
  title,
  onComplete,
  onClose,
}: Props) {
  const target = Math.max(1, watchSeconds || 30);
  const [phase, setPhase] = useState<Phase>("warmup");
  const [warmupLeft, setWarmupLeft] = useState(WARMUP);
  const [watched, setWatched] = useState(0);
  const watchedRef = useRef(0);
  const visibleRef = useRef(true);
  const doneRef = useRef(false);

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Pause the timer when the user tabs away
  useEffect(() => {
    const onVis = () => {
      visibleRef.current = !document.hidden;
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Warmup countdown — transition happens inside the timeout (not synchronously
  // in the effect body) to avoid cascading renders.
  useEffect(() => {
    if (phase !== "warmup") return;
    const t = setTimeout(() => {
      if (warmupLeft <= 1) {
        setPhase("watch");
      } else {
        setWarmupLeft((s) => s - 1);
      }
    }, 1000);
    return () => clearTimeout(t);
  }, [phase, warmupLeft]);

  // Watch ticker (1s), pauses when hidden
  useEffect(() => {
    if (phase !== "watch") return;
    const id = setInterval(() => {
      if (!visibleRef.current) return;
      const next = Math.min(target, watchedRef.current + 1);
      watchedRef.current = next;
      setWatched(next);
      if (next >= target) {
        clearInterval(id);
        setPhase("complete");
      }
    }, 1000);
    return () => clearInterval(id);
  }, [phase, target]);

  // Fire onComplete once when done
  useEffect(() => {
    if (phase !== "complete" || doneRef.current) return;
    doneRef.current = true;
    onComplete();
    const t = setTimeout(() => onClose(), 1400);
    return () => clearTimeout(t);
  }, [phase, onComplete, onClose]);

  const handleCancel = () => {
    if (phase !== "complete" && watched < target) {
      const ok = window.confirm("Quit now? This action won't be counted.");
      if (!ok) return;
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-100 bg-black flex flex-col">
      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-4 py-3 bg-linear-to-b from-black/80 to-transparent">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">
            Watch to unlock
          </p>
          {title && (
            <p className="text-sm text-white font-semibold truncate">{title}</p>
          )}
        </div>
        <button
          onClick={handleCancel}
          className="ml-3 p-2 rounded-full bg-gray-900/60 hover:bg-gray-800 text-gray-300"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Player */}
      <div className="relative flex-1">
        {url ? (
          <ReactPlayer
            src={url}
            playing
            playsInline
            controls={false}
            width="100%"
            height="100%"
            style={{ position: "absolute", inset: 0, backgroundColor: "#000" }}
            config={{ youtube: { disablekb: 1, rel: 0, fs: 0 } }}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-gray-400">
            <p>No target URL configured.</p>
          </div>
        )}

        {/* Touch-block overlay — prevents pause/seek/skip */}
        <div
          className="absolute inset-0 z-10"
          onClick={(e) => e.preventDefault()}
          onTouchStart={(e) => e.preventDefault()}
          onTouchEnd={(e) => e.preventDefault()}
          onContextMenu={(e) => e.preventDefault()}
          style={{ touchAction: "none" }}
        />

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
                Stay on this screen.
              </p>
            </div>
          </div>
        )}

        {phase === "complete" && (
          <div className="absolute inset-0 z-20 grid place-items-center bg-emerald-950/90 pointer-events-none">
            <div className="text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <p className="text-lg text-white font-bold">Done!</p>
              <p className="text-sm text-emerald-200 mt-1">Action unlocked.</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom HUD — progress */}
      {phase === "watch" && (
        <div className="absolute bottom-0 inset-x-0 z-20 bg-linear-to-t from-black via-black/90 to-transparent px-4 pt-6 pb-5 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-300 inline-flex items-center gap-1.5">
              <PlayCircle className="w-4 h-4 text-indigo-400" />
              Watching
            </span>
            <span className="text-white tabular-nums font-mono">
              {formatDuration(watched)} / {formatDuration(target)}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
            <div
              className="h-full bg-linear-to-r from-indigo-500 to-purple-500 transition-[width] duration-300"
              style={{ width: `${(watched / target) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
