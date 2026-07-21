"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";

export type AdPlacement =
  | "IN_FEED"
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
  title?: string;
  body?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  html?: string;
  sponsor?: string;
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
    fetch(`/api/ads/serve?placement=${placement}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.ad) setAd(data.ad);
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

  if (ad.type === "HTML" && ad.html) {
    return (
      <div
        className={cn(
          "relative rounded-xl overflow-hidden border border-gray-800 bg-gray-900",
          className
        )}
        dangerouslySetInnerHTML={{ __html: ad.html }}
      />
    );
  }

  return (
    <a
      href={ad.ctaUrl ?? "#"}
      target="_blank"
      rel="noopener sponsored noreferrer"
      onClick={trackClick}
      className={cn(
        "relative block rounded-2xl overflow-hidden border border-gray-800 bg-gray-900 hover:border-indigo-500/40 hover:shadow-lg hover:shadow-indigo-500/5 transition-all group",
        className
      )}
    >
      <span className="absolute top-2 right-2 z-10 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur text-[9px] font-bold uppercase tracking-wider text-white/90">
        <Megaphone className="w-2.5 h-2.5" />
        Sponsored
      </span>
      {ad.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={ad.imageUrl}
          alt={ad.title ?? "Ad"}
          className="w-full h-32 object-cover"
        />
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
