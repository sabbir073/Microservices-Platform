"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";

const faqs = [
  {
    question: "How does EarnGPT work?",
    answer:
      "EarnGPT is a rewards platform where you earn points by completing simple tasks like watching videos, taking surveys, referring friends, and more. Points can be converted to real money and withdrawn to your preferred payment method.",
  },
  {
    question: "Is EarnGPT free to use?",
    answer:
      "Yes! EarnGPT is completely free to join and use. We offer a free plan with daily tasks and earning opportunities. Premium plans are optional and provide additional benefits like higher earning limits and lower withdrawal fees.",
  },
  {
    question: "How do I withdraw my earnings?",
    answer:
      "You can withdraw your earnings via bKash, Nagad, Rocket, Binance, or PayPal. Simply go to the Wallet section, select your preferred payment method, enter the amount, and submit your withdrawal request. Most withdrawals are processed within 24-48 hours.",
  },
  {
    question: "What is the minimum withdrawal amount?",
    answer:
      "The minimum withdrawal depends on your plan: Free ($10), Basic ($5), Standard ($3), and Premium ($1). We keep minimums low so you can cash out quickly!",
  },
  {
    question: "How does the referral system work?",
    answer:
      "Our 10-level referral system lets you earn commissions from your referrals' earnings up to 10 levels deep. When someone joins using your referral code and earns, you get a percentage of their earnings automatically.",
  },
  {
    question: "Are my earnings and data secure?",
    answer:
      "Absolutely! We use bank-level encryption to protect your data and funds. All transactions are secured with 2FA verification, and we never share your personal information with third parties.",
  },
  {
    question: "How many tasks can I complete daily?",
    answer:
      "Task limits depend on your plan: Free (5/day), Basic (20/day), Standard (50/day), and Premium (unlimited). New tasks are added every day across various categories.",
  },
  {
    question: "Can I use EarnGPT from any country?",
    answer:
      "EarnGPT is available worldwide! However, some tasks may be region-specific. We continuously add new tasks for different regions to ensure everyone has earning opportunities.",
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="py-20 sm:py-28 bg-gray-950">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-4">
            FAQ
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            Frequently Asked{" "}
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Questions
            </span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">
            Got questions? We&apos;ve got answers. Can&apos;t find what you&apos;re looking for? Contact support.
          </p>
        </div>

        {/* FAQ List */}
        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className={`rounded-xl border transition-colors ${
                openIndex === i
                  ? "bg-gray-900 border-indigo-500/50"
                  : "bg-gray-900/50 border-gray-800 hover:border-gray-700"
              }`}
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between p-5 text-left"
              >
                <span
                  className={`font-medium pr-4 ${
                    openIndex === i ? "text-white" : "text-gray-300"
                  }`}
                >
                  {faq.question}
                </span>
                <span
                  className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    openIndex === i
                      ? "bg-indigo-500 text-white"
                      : "bg-gray-800 text-gray-400"
                  }`}
                >
                  {openIndex === i ? (
                    <Minus className="w-4 h-4" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                </span>
              </button>
              {openIndex === i && (
                <div className="px-5 pb-5">
                  <p className="text-gray-400 leading-relaxed">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Contact CTA */}
        <div className="text-center mt-12">
          <p className="text-gray-500 mb-2">Still have questions?</p>
          <a
            href="mailto:support@earngpt.com"
            className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
          >
            Contact our support team →
          </a>
        </div>
      </div>
    </section>
  );
}
