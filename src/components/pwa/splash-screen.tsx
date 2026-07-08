"use client";

import { useEffect, useState } from "react";
import { X, ChevronRight, Sparkles } from "lucide-react";
import type { SplashConfig } from "@/lib/splash";

const SEEN_KEY = "splash_seen_v1";

export function SplashScreen() {
  const [cfg, setCfg] = useState<SplashConfig | null>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Don't interrupt admins.
    if (window.location.pathname.startsWith("/admin")) return;

    let cancelled = false;
    fetch("/api/splash")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d?.enabled || !Array.isArray(d.slides) || d.slides.length === 0) return;
        // Frequency policy.
        if (d.frequency === "once" && localStorage.getItem(SEEN_KEY)) return;
        if (d.frequency === "session" && sessionStorage.getItem(SEEN_KEY)) return;
        setCfg({
          enabled: true,
          durationMs: Number(d.durationMs) || 3500,
          frequency: d.frequency,
          slides: d.slides,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-advance.
  useEffect(() => {
    if (!cfg || cfg.slides.length <= 1) return;
    const t = setTimeout(() => {
      setActive((p) => Math.min(p + 1, cfg.slides.length - 1));
    }, cfg.durationMs);
    return () => clearTimeout(t);
  }, [cfg, active]);

  const dismiss = () => {
    if (!cfg) return;
    if (cfg.frequency === "once") localStorage.setItem(SEEN_KEY, "1");
    if (cfg.frequency === "session") sessionStorage.setItem(SEEN_KEY, "1");
    setCfg(null);
  };

  if (!cfg) return null;

  const slide = cfg.slides[active];
  const isLast = active === cfg.slides.length - 1;

  return (
    <div className="fixed inset-0 z-100 bg-gray-950 flex flex-col">
      {/* Skip */}
      <button
        onClick={dismiss}
        className="absolute top-4 right-4 z-10 inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-gray-900/70 text-gray-300 text-xs font-semibold hover:text-white"
      >
        Skip <X className="w-3.5 h-3.5" />
      </button>

      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-full max-w-sm">
          <div className="aspect-square w-full max-w-xs mx-auto rounded-3xl overflow-hidden bg-gray-900 border border-gray-800 flex items-center justify-center mb-8">
            {slide.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={slide.imageUrl} alt={slide.title} className="w-full h-full object-cover" />
            ) : (
              <Sparkles className="w-16 h-16 text-indigo-400" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-white">{slide.title}</h1>
          {slide.content && (
            <p className="mt-3 text-gray-400 leading-relaxed whitespace-pre-wrap">{slide.content}</p>
          )}
        </div>
      </div>

      {/* Dots + CTA */}
      <div className="pb-10 px-6 space-y-6">
        <div className="flex items-center justify-center gap-2">
          {cfg.slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              aria-label={`Slide ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                i === active ? "w-6 bg-indigo-500" : "w-1.5 bg-gray-700"
              }`}
            />
          ))}
        </div>
        <div className="max-w-sm mx-auto">
          {isLast ? (
            <button
              onClick={dismiss}
              className="w-full py-3 rounded-xl bg-linear-to-r from-indigo-500 to-purple-600 text-white font-bold"
            >
              Get started
            </button>
          ) : (
            <button
              onClick={() => setActive((p) => Math.min(p + 1, cfg.slides.length - 1))}
              className="w-full py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-semibold inline-flex items-center justify-center gap-1"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
