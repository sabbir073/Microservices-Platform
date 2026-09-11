"use client";

import Link from "next/link";
import {
  ArrowRight,
  Play,
  Users,
  DollarSign,
  CheckCircle,
  Star,
  Trophy,
  Sparkles,
  TrendingUp,
  Zap,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { HeroContent } from "@/lib/landing-content";
import { DEFAULT_LANDING_CONTENT } from "@/lib/landing-content";

const ICONS: Record<string, LucideIcon> = {
  Users,
  DollarSign,
  CheckCircle,
  Star,
  Trophy,
  Sparkles,
  TrendingUp,
  Zap,
};

type Props = Partial<HeroContent>;

export function Hero(props: Props) {
  const v: HeroContent = { ...DEFAULT_LANDING_CONTENT.hero, ...props };

  return (
    <section
      id="hero"
      className="relative pt-24 sm:pt-28 lg:pt-36 pb-16 sm:pb-24 overflow-hidden"
    >
      {/* Subtle fine grid, theme-aware and calm */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] [mask-image:radial-gradient(60%_50%_at_50%_0%,black,transparent)]"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--mk-grid) 1px, transparent 1px), linear-gradient(to bottom, var(--mk-grid) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="text-center max-w-4xl mx-auto">
          <div className="mk-card inline-flex max-w-full items-center gap-2 px-3 sm:px-4 py-1.5 rounded-full mb-6 sm:mb-8">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="min-w-0 truncate text-xs sm:text-sm text-(--mk-text) font-medium">
              {v.badge}
            </span>
          </div>

          {/* 36px extrabold on a 328px-wide 360px viewport breaks mid-word on
              a three-word line. The mobile step starts at 32px and the ramp is
              32 → 48 → 60 → 72, one clean step per breakpoint. */}
          <h1 className="text-[2rem] sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.1] sm:leading-[1.08] tracking-tight text-pretty mb-4 sm:mb-6">
            <span className="block text-(--mk-text)">{v.title_line1}</span>
            <span className="block bg-linear-to-r from-indigo-600 via-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
              {v.title_line2}
            </span>
          </h1>

          {/* max-w-xl at 20px keeps the measure near 65 characters. Without a
              cap the sub-headline ran the full 896px of the column. */}
          <p className="text-base sm:text-lg lg:text-xl text-(--mk-muted) max-w-xl sm:max-w-2xl mx-auto mb-7 sm:mb-10 leading-relaxed text-balance">
            {v.subtitle}
          </p>

          {/* The primary action is visually first on every size. On mobile the
              two buttons stack full-width at 56px tall; `sm:` puts them side by
              side with the primary leading. */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-5">
            <Link
              href={v.cta_primary_href}
              className="mk-zoom w-full sm:w-auto min-h-14 px-8 py-4 bg-linear-to-r from-indigo-600 to-violet-600 text-white font-semibold rounded-xl hover:from-indigo-500 hover:to-violet-500 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25"
            >
              {v.cta_primary_label}
              <ArrowRight className="w-5 h-5 shrink-0" />
            </Link>
            <a
              href={v.cta_secondary_href}
              className="w-full sm:w-auto min-h-14 px-8 py-4 bg-(--mk-surface) text-(--mk-text) font-semibold rounded-xl hover:bg-(--mk-surface-2) transition-colors flex items-center justify-center gap-2 border border-(--mk-border-strong)"
            >
              <Play className="w-5 h-5 shrink-0 text-indigo-600" />
              {v.cta_secondary_label}
            </a>
          </div>

          {/* Risk reversal belongs with the button it de-risks, not 64px below
              it. On a 360px screen the three claims wrap to their own lines
              rather than overflowing the viewport. */}
          <p className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs sm:text-sm text-(--mk-subtle) mb-12 sm:mb-16">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>No credit card required</span>
            <span aria-hidden>·</span>
            <span>Free to start</span>
            <span aria-hidden>·</span>
            <span>Withdraw anytime</span>
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {v.stats.map((stat, i) => {
              const Icon = ICONS[stat.iconKey] ?? Star;
              return (
                <div
                  key={i}
                  className="mk-card mk-zoom group min-w-0 rounded-2xl p-4 sm:p-5 hover:border-(--mk-border-strong)"
                >
                  <Icon className="w-6 h-6 text-indigo-600 mx-auto mb-2" />
                  <div className="text-2xl sm:text-3xl font-extrabold text-(--mk-text) tabular-nums">
                    {stat.value}
                  </div>
                  <div className="text-xs sm:text-sm text-(--mk-subtle) mt-1 text-balance">
                    {stat.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
