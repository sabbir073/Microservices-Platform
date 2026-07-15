"use client";

import { useEffect, useRef, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { AdInterstitialOverlay } from "@/components/user/primitives/ad-interstitial-overlay";

export interface PlayableGame {
  id: string;
  title: string;
  embedUrl: string;
}

// Min gap between interstitials so tab-switching doesn't spam ads (ms).
const AD_THROTTLE_MS = 60_000;

export function GamePlayer({ game, onClose }: { game: PlayableGame; onClose: () => void }) {
  const [started, setStarted] = useState(false);
  const [showAd, setShowAd] = useState(true); // open ad shows first
  const afterAdRef = useRef<() => void>(() => setStarted(true));
  const lastAdRef = useRef(0);
  const wasHiddenRef = useRef(false);

  // Count a play once + lock body scroll while the player is open.
  useEffect(() => {
    fetch(`/api/games/${game.id}/play`, { method: "POST" }).catch(() => {});
  }, [game.id]);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const handleAdDone = () => {
    setShowAd(false);
    lastAdRef.current = Date.now();
    const fn = afterAdRef.current;
    afterAdRef.current = () => {};
    fn();
  };

  // Pause/resume: when the user returns to the tab after leaving, show an ad.
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        wasHiddenRef.current = true;
        return;
      }
      if (wasHiddenRef.current && started && !showAd) {
        wasHiddenRef.current = false;
        if (Date.now() - lastAdRef.current > AD_THROTTLE_MS) {
          afterAdRef.current = () => {}; // just resume after the ad
          setShowAd(true);
        }
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [started, showAd]);

  const quit = () => {
    afterAdRef.current = onClose;
    setShowAd(true);
  };

  return (
    <div className="fixed inset-0 z-10000 bg-black flex flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-3 h-12 bg-gray-950 border-b border-gray-800 shrink-0">
        <p className="text-sm font-bold text-white truncate flex-1">{game.title}</p>
        <button
          onClick={quit}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-xs font-semibold"
        >
          <X className="w-4 h-4" /> Quit
        </button>
      </div>

      {/* Play surface */}
      <div className="flex-1 relative bg-black">
        {started ? (
          <iframe
            src={game.embedUrl}
            title={game.title}
            className="absolute inset-0 w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-orientation-lock"
            allow="fullscreen; autoplay; gamepad; accelerometer; gyroscope; clipboard-write"
            allowFullScreen
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-7 h-7 animate-spin text-gray-600" />
          </div>
        )}
      </div>

      <AdInterstitialOverlay open={showAd} onDone={handleAdDone} />
    </div>
  );
}
