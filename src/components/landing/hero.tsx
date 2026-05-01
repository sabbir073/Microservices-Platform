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
    <section id="hero" className="relative pt-28 pb-32 overflow-hidden">
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl mb-8">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-sm text-slate-200 font-medium">{v.badge}</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-tight mb-6">
            <span className="block text-white">{v.title_line1}</span>
            <span className="block bg-linear-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              {v.title_line2}
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
            {v.subtitle}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link
              href={v.cta_primary_href}
              className="w-full sm:w-auto px-8 py-4 bg-linear-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:scale-105 transition-transform flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30"
            >
              {v.cta_primary_label}
              <ArrowRight className="w-5 h-5" />
            </Link>
            <a
              href={v.cta_secondary_href}
              className="w-full sm:w-auto px-8 py-4 bg-white/5 text-white font-semibold rounded-xl hover:bg-white/10 transition-colors flex items-center justify-center gap-2 border border-white/20 backdrop-blur-xl"
            >
              <Play className="w-5 h-5" />
              {v.cta_secondary_label}
            </a>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {v.stats.map((stat, i) => {
              const Icon = ICONS[stat.iconKey] ?? Star;
              return (
                <div
                  key={i}
                  className="group rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-4 sm:p-5 hover:bg-white/10 hover:border-blue-500/50 hover:scale-105 transition-all duration-300"
                >
                  <Icon className="w-6 h-6 text-blue-400 mx-auto mb-2 group-hover:text-blue-300" />
                  <div className="text-2xl sm:text-3xl font-extrabold text-white tabular-nums">
                    {stat.value}
                  </div>
                  <div className="text-xs sm:text-sm text-slate-400 mt-1">
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
