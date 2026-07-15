"use client";

import { useEffect, useRef } from "react";
import { CheckCircle, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPostBackground } from "@/lib/post-backgrounds";

/** A native feed ad, shaped by GET /api/ads/feed. Renders like a real post. */
export interface FeedAd {
  adId: string;
  kind: "post" | "brand";
  author: {
    name: string;
    username: string | null;
    avatar: string | null;
    isBlueVerified: boolean;
    verifiedBadgeStyle: string | null;
  };
  content: string;
  images: string[];
  backgroundStyle: string | null;
  ctaLabel: string;
  targetUrl: string | null;
}

export function FeedAdCard({ ad }: { ad: FeedAd }) {
  const ref = useRef<HTMLElement | null>(null);
  const firedRef = useRef(false);

  // Count one impression when the ad first scrolls into view.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !firedRef.current) {
            firedRef.current = true;
            fetch(`/api/ads/${ad.adId}/impression`, { method: "POST" }).catch(
              () => {}
            );
            io.disconnect();
          }
        }
      },
      { threshold: 0.5 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ad.adId]);

  const trackClick = () => {
    fetch(`/api/ads/${ad.adId}/click`, { method: "POST" }).catch(() => {});
  };

  const initial = (ad.author.name || "A").charAt(0).toUpperCase();
  const postBg =
    ad.images.length === 0 ? getPostBackground(ad.backgroundStyle) : null;

  return (
    <article
      ref={ref}
      className="relative rounded-xl border border-gray-800 bg-gray-900 overflow-hidden"
    >
      <div className="p-4">
        {/* Header — avatar + name + "Sponsored" (mimics a real post) */}
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-10 h-10 rounded-full bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-medium overflow-hidden">
            {ad.author.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={ad.author.avatar}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              initial
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-1.5">
              <span className="text-sm font-semibold text-white">
                {ad.author.name}
              </span>
              {ad.author.isBlueVerified && (
                <CheckCircle
                  className="w-3.5 h-3.5 text-blue-400 fill-blue-500/30"
                  aria-label="Verified"
                />
              )}
            </div>
            <p className="text-[11px] text-gray-500">Sponsored</p>
          </div>
        </div>

        {/* Content */}
        {ad.content &&
          (postBg ? (
            <div
              className={cn(
                "mt-3 rounded-xl px-4 py-10 min-h-40 flex items-center justify-center text-center",
                postBg.className
              )}
            >
              <p
                className={cn(
                  "text-xl font-bold leading-snug whitespace-pre-wrap break-words",
                  postBg.textClass
                )}
              >
                {ad.content}
              </p>
            </div>
          ) : (
            <p className="text-[15px] text-gray-200 leading-relaxed whitespace-pre-wrap mt-3">
              {ad.content}
            </p>
          ))}
      </div>

      {/* Images */}
      {ad.images.length > 0 && (
        <a
          href={ad.targetUrl ?? "#"}
          target="_blank"
          rel="noopener sponsored noreferrer"
          onClick={trackClick}
          className={cn(
            "grid gap-px bg-gray-800",
            ad.images.length === 1 && "grid-cols-1",
            ad.images.length === 2 && "grid-cols-2",
            ad.images.length >= 3 && "grid-cols-3"
          )}
        >
          {ad.images.slice(0, 6).map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={url}
              alt=""
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
              className={cn(
                "w-full bg-gray-950",
                ad.images.length === 1
                  ? "max-h-[70vh] object-contain"
                  : "aspect-square object-cover"
              )}
            />
          ))}
        </a>
      )}

      {/* CTA row (replaces like/comment/share) */}
      <a
        href={ad.targetUrl ?? "#"}
        target="_blank"
        rel="noopener sponsored noreferrer"
        onClick={trackClick}
        className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-gray-800 hover:bg-gray-800/40 transition-colors group"
      >
        <span className="text-[11px] uppercase tracking-wider text-gray-500 font-bold">
          Sponsored
        </span>
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-400 group-hover:text-indigo-300">
          {ad.ctaLabel}
          <ExternalLink className="w-3.5 h-3.5" />
        </span>
      </a>
    </article>
  );
}
