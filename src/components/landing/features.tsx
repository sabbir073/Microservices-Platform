"use client";

import {
  Pin,
  Video,
  FileText,
  ClipboardList,
  Send,
  Users,
  Globe,
  Trophy,
  Sparkles,
  Gift,
  Wallet,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import type { FeaturesContent } from "@/lib/landing-content";
import { DEFAULT_LANDING_CONTENT } from "@/lib/landing-content";

const ICONS: Record<string, LucideIcon> = {
  Pin,
  Video,
  FileText,
  ClipboardList,
  Send,
  Users,
  Globe,
  Trophy,
  Sparkles,
  Gift,
  Wallet,
  Smartphone,
};

type Props = Partial<FeaturesContent>;

export function Features(props: Props) {
  const v: FeaturesContent = { ...DEFAULT_LANDING_CONTENT.features, ...props };

  return (
    <section id="features" className="py-20 sm:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="inline-block px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-4">
            {v.badge}
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-4">
            {v.heading_line1}{" "}
            <span className="bg-linear-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              {v.heading_line2}
            </span>
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto text-lg">{v.subheading}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {v.items.map((feature, i) => {
            const Icon = ICONS[feature.iconKey] ?? Sparkles;
            return (
              <div
                key={i}
                className="group p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl hover:bg-white/10 hover:scale-105 hover:border-blue-500/30 transition-all duration-300"
              >
                <div
                  className={`w-14 h-14 rounded-2xl bg-linear-to-br ${feature.gradient} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform`}
                >
                  <Icon className="w-7 h-7 text-white" />
                </div>

                <h3 className="text-lg font-bold text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
