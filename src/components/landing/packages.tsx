"use client";

import {
  Check,
  Zap,
  Star,
  Sparkles,
  Crown,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { PackagesContent } from "@/lib/landing-content";
import { DEFAULT_LANDING_CONTENT } from "@/lib/landing-content";

const ICONS: Record<string, LucideIcon> = {
  Zap,
  Star,
  Sparkles,
  Crown,
  Trophy,
};

type Props = Partial<PackagesContent>;

export function Packages(props: Props) {
  const v: PackagesContent = { ...DEFAULT_LANDING_CONTENT.packages, ...props };

  return (
    <section id="pricing" className="py-20 sm:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="inline-block px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-4">
            {v.badge}
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-4">
            {v.heading_line1}{" "}
            <span className="bg-linear-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
              {v.heading_line2}
            </span>
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto text-lg">
            {v.subheading}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 lg:gap-8">
          {v.plans.map((pkg, i) => {
            const Icon = ICONS[pkg.iconKey] ?? Star;
            return (
              <div
                key={i}
                className={`relative rounded-2xl p-6 lg:p-8 backdrop-blur-xl transition-all duration-300 ${
                  pkg.is_popular
                    ? "bg-linear-to-b from-purple-500/15 to-pink-500/10 border-2 border-purple-500/60 scale-105 shadow-2xl shadow-purple-500/20"
                    : "bg-white/5 border border-white/10 hover:bg-white/10 hover:border-blue-500/30"
                }`}
              >
                {pkg.is_popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-4 py-1 rounded-full bg-purple-500 text-white text-xs font-bold uppercase">
                      Most Popular
                    </span>
                  </div>
                )}

                <div
                  className={`w-12 h-12 rounded-xl bg-linear-to-br ${pkg.gradient} flex items-center justify-center mb-4`}
                >
                  <Icon className="w-6 h-6 text-white" />
                </div>

                <h3 className="text-xl font-bold text-white mb-1">{pkg.name}</h3>
                <p className="text-sm text-slate-400 mb-4">{pkg.description}</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-extrabold text-white">{pkg.price}</span>
                  <span className="text-slate-400">{pkg.period}</span>
                </div>

                <ul className="space-y-3 mb-8">
                  {pkg.features.map((feature, j) => (
                    <li
                      key={j}
                      className="flex items-start gap-3 text-sm text-slate-300"
                    >
                      <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/register"
                  className={`block w-full py-3 text-center font-semibold rounded-xl transition-all ${
                    pkg.is_popular
                      ? "bg-linear-to-r from-purple-500 to-pink-500 text-white hover:scale-105"
                      : "bg-white/5 text-white hover:bg-white/10 border border-white/20"
                  }`}
                >
                  {pkg.cta_label}
                </Link>
              </div>
            );
          })}
        </div>

        <div className="text-center mt-12">
          <p className="text-slate-400 text-sm">{v.guarantee_text}</p>
        </div>
      </div>
    </section>
  );
}
