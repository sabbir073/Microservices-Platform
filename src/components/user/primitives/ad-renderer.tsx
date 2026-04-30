"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export type AdPlacement =
  | "IN_FEED"
  | "TASK_LIST"
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
        "relative block rounded-xl overflow-hidden border border-gray-800 bg-gray-900 hover:border-gray-700 transition-colors group",
        className
      )}
    >
      <span className="absolute top-2 right-2 z-10 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur text-[9px] font-bold uppercase text-white">
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
      <div className="p-3">
        {ad.title && (
          <p className="text-sm font-semibold text-white line-clamp-1">
            {ad.title}
          </p>
        )}
        {ad.body && (
          <p className="text-xs text-gray-400 line-clamp-2 mt-0.5">
            {ad.body}
          </p>
        )}
        <div className="flex items-center justify-between mt-2">
          {ad.sponsor && (
            <span className="text-[10px] text-gray-500">by {ad.sponsor}</span>
          )}
          {ad.ctaLabel && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 group-hover:text-indigo-300">
              {ad.ctaLabel}
              <ExternalLink className="w-3 h-3" />
            </span>
          )}
        </div>
      </div>
    </a>
  );
}
