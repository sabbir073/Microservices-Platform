"use client";

import {
  UserPlus,
  ListTodo,
  Coins,
  Wallet,
  CheckCircle,
  Send,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { HowItWorksContent } from "@/lib/landing-content";
import { DEFAULT_LANDING_CONTENT } from "@/lib/landing-content";

const ICONS: Record<string, LucideIcon> = {
  UserPlus,
  ListTodo,
  Coins,
  Wallet,
  CheckCircle,
  Send,
  Sparkles,
};

type Props = Partial<HowItWorksContent>;

export function HowItWorks(props: Props) {
  const v: HowItWorksContent = {
    ...DEFAULT_LANDING_CONTENT.how_it_works,
    ...props,
  };

  return (
    <section id="how-it-works" className="py-20 sm:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="inline-block px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 text-xs font-semibold uppercase tracking-wider mb-4">
            {v.badge}
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-4">
            {v.heading_line1}{" "}
            <span className="bg-linear-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              {v.heading_line2}
            </span>
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto text-lg">{v.subheading}</p>
        </div>

        <div className="relative">
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-linear-to-r from-blue-500/50 via-purple-500/50 to-pink-500/50 hidden lg:block -translate-y-1/2 pointer-events-none" />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 relative">
            {v.steps.map((step, i) => {
              const Icon = ICONS[step.iconKey] ?? Sparkles;
              return (
                <div
                  key={i}
                  className="relative p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl hover:bg-white/10 hover:scale-105 transition-all duration-300 text-center"
                >
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span
                      className={`inline-flex items-center justify-center w-10 h-10 rounded-full bg-linear-to-r ${step.gradient} text-white text-sm font-extrabold shadow-lg`}
                    >
                      {step.step_number}
                    </span>
                  </div>

                  <div
                    className={`w-16 h-16 mx-auto mt-4 rounded-2xl bg-linear-to-br ${step.gradient} flex items-center justify-center mb-4 shadow-lg`}
                  >
                    <Icon className="w-8 h-8 text-white" />
                  </div>

                  <h3 className="text-lg font-bold text-white mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
