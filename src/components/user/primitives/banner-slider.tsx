"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";

export interface BannerSlide {
  id: string;
  title?: string;
  subtitle?: string;
  imageUrl?: string;
  ctaLabel?: string;
  ctaHref?: string;
  bgGradient?: string;
}

interface BannerSliderProps {
  slides: BannerSlide[];
  autoMs?: number;
  className?: string;
}

const FALLBACK_GRADIENTS = [
  "from-indigo-600 to-purple-600",
  "from-emerald-600 to-cyan-600",
  "from-amber-500 to-pink-600",
  "from-purple-600 to-pink-600",
];

export function BannerSlider({
  slides,
  autoMs = 4000,
  className,
}: BannerSliderProps) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const id = setInterval(
      () => setActive((p) => (p + 1) % slides.length),
      autoMs
    );
    return () => clearInterval(id);
  }, [slides.length, autoMs]);

  if (slides.length === 0) return null;

  return (
    <div className={cn("relative", className)}>
      <div className="relative h-32 sm:h-36 overflow-hidden rounded-2xl">
        {slides.map((s, i) => {
          const grad =
            s.bgGradient ?? FALLBACK_GRADIENTS[i % FALLBACK_GRADIENTS.length];
          const cls = cn(
            "absolute inset-0 transition-opacity duration-700 flex items-center px-5",
            "bg-linear-to-br",
            grad,
            i === active ? "opacity-100" : "opacity-0 pointer-events-none"
          );
          const style = s.imageUrl
            ? {
                backgroundImage: `linear-gradient(to right, rgba(15,23,42,.7), rgba(15,23,42,.3)), url(${s.imageUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined;
          const inner = (
            <div className="text-white max-w-[70%]">
              {s.title && (
                <p className="text-base font-bold leading-tight">{s.title}</p>
              )}
              {s.subtitle && (
                <p className="text-xs opacity-90 mt-1 line-clamp-2">
                  {s.subtitle}
                </p>
              )}
              {s.ctaLabel && (
                <span className="inline-block mt-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur text-[11px] font-semibold">
                  {s.ctaLabel} →
                </span>
              )}
            </div>
          );
          if (s.ctaHref) {
            return (
              <Link key={s.id} href={s.ctaHref} className={cls} style={style}>
                {inner}
              </Link>
            );
          }
          return (
            <div key={s.id} className={cls} style={style}>
              {inner}
            </div>
          );
        })}
      </div>
      {slides.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              aria-label={`Slide ${i + 1}`}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === active ? "w-5 bg-white" : "w-1.5 bg-white/40"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
