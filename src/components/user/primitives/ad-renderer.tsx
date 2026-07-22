"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveAdSize } from "@/lib/ad-sizes";

export type AdPlacement =
  | "IN_FEED"
  | "FEED_SIDEBAR"
  | "TASK_LIST"
  | "TASK_START"
  | "VIDEO_ABOVE"
  | "VIDEO_BELOW"
  | "TASK_COMPLETE"
  | "GAME_INTERSTITIAL"
  | "VIDEO_INTERSTITIAL"
  | "DASHBOARD"
  | "EARN_HUB"
  | "EARN_PROMOTE"
  | "WALLET_TOP"
  | "MARKETPLACE_TOP"
  | "PROFILE_BOTTOM";

export type AdType = "LOCAL" | "HTML" | "SDK" | "META";

export interface AdResponse {
  id: string;
  type: AdType;
  imageUrl?: string;
  videoUrl?: string;
  title?: string;
  body?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  html?: string;
  sponsor?: string;
  size?: string;
  width?: number;
  height?: number;
}

interface AdRendererProps {
  placement: AdPlacement;
  className?: string;
}

export function AdRenderer({ placement, className }: AdRendererProps) {
  const [ad, setAd] = useState<AdResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Exclude the ad shown last time in this placement (this session) so a
    // reload / re-navigate rotates to a different creative when possible.
    const storeKey = `ad-last-${placement}`;
    let last: string | null = null;
    try {
      last = sessionStorage.getItem(storeKey);
    } catch {
      /* sessionStorage unavailable */
    }
    fetch(
      `/api/ads/serve?placement=${placement}${last ? `&exclude=${encodeURIComponent(last)}` : ""}`
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.ad) {
          setAd(data.ad);
          try {
            sessionStorage.setItem(storeKey, data.ad.id);
          } catch {
            /* ignore */
          }
        }
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [placement]);

  if (error || !ad) return null;

  const trackClick = () => {
    fetch(`/api/ads/${ad.id}/click`, { method: "POST" }).catch(() => {});
  };

  const dim = resolveAdSize(ad.size, ad.width, ad.height);
  // Fixed-size ads cap their width and honor the aspect ratio (no crop);
  // responsive ads stretch to the container at natural height.
  const mediaStyle = dim
    ? { aspectRatio: `${dim.w} / ${dim.h}` }
    : undefined;
  const outerStyle = dim ? { maxWidth: dim.w } : undefined;

  // HTML / ad-network tag creative — run inside a sandboxed iframe so injected
  // <script> actually executes (dangerouslySetInnerHTML never runs scripts).
  if (ad.type === "HTML" && ad.html) {
    return (
      <div
        className={cn(
          "relative rounded-xl overflow-hidden border border-gray-800 bg-gray-900 mx-auto",
          className
        )}
        style={outerStyle}
      >
        <iframe
          title="Sponsored"
          srcDoc={ad.html}
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          className="block w-full border-0"
          style={{ height: dim?.h ?? 250 }}
        />
      </div>
    );
  }

  return (
    <a
      href={ad.ctaUrl ?? "#"}
      target="_blank"
      rel="noopener sponsored noreferrer"
      onClick={trackClick}
      style={outerStyle}
      className={cn(
        "relative block rounded-2xl overflow-hidden border border-gray-800 bg-gray-900 hover:border-indigo-500/40 hover:shadow-lg hover:shadow-indigo-500/5 transition-all group mx-auto",
        className
      )}
    >
      <span className="absolute top-2 right-2 z-10 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur text-[9px] font-bold uppercase tracking-wider text-white/90">
        <Megaphone className="w-2.5 h-2.5" />
        Sponsored
      </span>
      {ad.videoUrl ? (
        <video
          src={ad.videoUrl}
          autoPlay
          muted
          loop
          playsInline
          className={cn("w-full object-contain bg-black", !dim && "h-auto")}
          style={mediaStyle}
        />
      ) : (
        ad.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ad.imageUrl}
            alt={ad.title ?? "Ad"}
            className={cn("w-full object-contain", !dim && "h-auto")}
            style={mediaStyle}
          />
        )
      )}
      <div className="p-3.5">
        {ad.title && (
          <p className="text-sm font-bold text-white line-clamp-1">
            {ad.title}
          </p>
        )}
        {ad.body && (
          <p className="text-xs text-gray-400 line-clamp-2 mt-0.5">
            {ad.body}
          </p>
        )}
        <div className="flex items-center justify-between mt-2.5">
          <span className="text-[10px] text-gray-500">
            {ad.sponsor ? `by ${ad.sponsor}` : "Sponsored"}
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/15 text-xs font-bold text-indigo-300 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
            {ad.ctaLabel || "Learn More"}
            <ExternalLink className="w-3 h-3" />
          </span>
        </div>
      </div>
    </a>
  );
}
