"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { FaqContent } from "@/lib/landing-content";
import { DEFAULT_LANDING_CONTENT } from "@/lib/landing-content";

type Props = Partial<FaqContent>;

export function FAQ(props: Props) {
  const v: FaqContent = { ...DEFAULT_LANDING_CONTENT.faq, ...props };
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="py-20 sm:py-28">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="inline-block px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-4">
            {v.badge}
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-4">
            {v.heading_line1}{" "}
            <span className="bg-linear-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              {v.heading_line2}
            </span>
          </h2>
          <p className="text-slate-400 text-lg">{v.subheading}</p>
        </div>

        <div className="space-y-3">
          {v.items.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <div
                key={i}
                className={`rounded-2xl border bg-white/5 backdrop-blur-xl transition-colors ${
                  isOpen
                    ? "border-blue-500/40"
                    : "border-white/10 hover:border-blue-500/30"
                }`}
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-left"
                  aria-expanded={isOpen}
                >
                  <span
                    className={`font-semibold pr-4 ${
                      isOpen ? "text-white" : "text-slate-200"
                    }`}
                  >
                    {faq.question}
                  </span>
                  <span
                    className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                      isOpen
                        ? "bg-blue-500/20 text-blue-300"
                        : "bg-white/5 text-slate-400"
                    }`}
                  >
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </span>
                </button>
                {isOpen && (
                  <div className="px-5 pb-5">
                    <p className="text-slate-300 leading-relaxed">{faq.answer}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="text-center mt-10">
          <p className="text-slate-400 mb-1">{v.contact_prompt}</p>
          <a
            href={`mailto:${v.contact_email}`}
            className="text-blue-400 hover:text-blue-300 font-semibold transition-colors"
          >
            {v.contact_label}
          </a>
        </div>
      </div>
    </section>
  );
}
