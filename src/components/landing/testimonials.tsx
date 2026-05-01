"use client";

import { Star, BadgeCheck, Quote } from "lucide-react";
import type { TestimonialsContent } from "@/lib/landing-content";
import { DEFAULT_LANDING_CONTENT } from "@/lib/landing-content";

type Props = Partial<TestimonialsContent>;

export function Testimonials(props: Props) {
  const v: TestimonialsContent = {
    ...DEFAULT_LANDING_CONTENT.testimonials,
    ...props,
  };

  return (
    <section id="testimonials" className="py-20 sm:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="inline-block px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs font-semibold uppercase tracking-wider mb-4">
            {v.badge}
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-4">
            {v.heading_line1}{" "}
            <span className="bg-linear-to-r from-yellow-400 to-amber-400 bg-clip-text text-transparent">
              {v.heading_line2}
            </span>
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto text-lg">{v.subheading}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {v.items.map((t, i) => (
            <div
              key={i}
              className="relative p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl hover:bg-white/10 hover:border-blue-500/30 hover:scale-105 transition-all duration-300"
            >
              <Quote className="absolute top-4 right-4 w-8 h-8 text-blue-500/20" />

              <div className="flex items-center gap-3 mb-4">
                <div
                  className={`w-12 h-12 rounded-full bg-linear-to-br ${t.gradient} flex items-center justify-center text-white font-bold text-base shadow-lg`}
                >
                  {t.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <h4 className="font-semibold text-white">{t.name}</h4>
                    <BadgeCheck className="w-4 h-4 text-blue-400" />
                  </div>
                  <p className="text-xs text-slate-400">
                    {t.country} ·{" "}
                    <span className="text-emerald-400 font-bold">
                      {t.earned} earned
                    </span>
                  </p>
                </div>
              </div>

              <p className="text-slate-300 leading-relaxed text-sm mb-4">
                &quot;{t.quote}&quot;
              </p>

              <div className="flex items-center gap-0.5">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star
                    key={j}
                    className="w-4 h-4 fill-amber-400 text-amber-400"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
