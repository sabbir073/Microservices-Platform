"use client";

import { UserPlus, ListTodo, Wallet, ArrowRight } from "lucide-react";
import Link from "next/link";

const steps = [
  {
    icon: UserPlus,
    step: "01",
    title: "Create Account",
    description: "Sign up for free in just 30 seconds. Use a referral code to get bonus points!",
    gradient: "from-indigo-500 to-indigo-600",
  },
  {
    icon: ListTodo,
    step: "02",
    title: "Complete Tasks",
    description: "Watch videos, complete surveys, invite friends, and do simple tasks daily.",
    gradient: "from-purple-500 to-purple-600",
  },
  {
    icon: Wallet,
    step: "03",
    title: "Withdraw Earnings",
    description: "Convert points to cash and withdraw to bKash, Nagad, Binance, or PayPal.",
    gradient: "from-green-500 to-emerald-500",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 sm:py-28 bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm font-medium mb-4">
            How It Works
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            Start Earning in{" "}
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              3 Easy Steps
            </span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">
            Getting started is quick and simple. Follow these steps and start earning today.
          </p>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Connection Line - Desktop */}
          <div className="absolute top-24 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-green-500 hidden lg:block" />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
            {steps.map((step, i) => (
              <div key={i} className="relative">
                {/* Card */}
                <div className="relative p-8 rounded-2xl bg-gray-800/50 border border-gray-700 text-center">
                  {/* Step Number Badge */}
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span
                      className={`inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r ${step.gradient} text-white text-sm font-bold`}
                    >
                      {step.step}
                    </span>
                  </div>

                  {/* Icon */}
                  <div
                    className={`w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br ${step.gradient} flex items-center justify-center mb-6`}
                  >
                    <step.icon className="w-10 h-10 text-white" />
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
                  <p className="text-gray-400 leading-relaxed">{step.description}</p>
                </div>

                {/* Arrow - Mobile */}
                {i < steps.length - 1 && (
                  <div className="flex justify-center my-4 lg:hidden">
                    <ArrowRight className="w-6 h-6 text-gray-600 rotate-90" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-16">
          <p className="text-gray-400 mb-4">Ready to start your earning journey?</p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity"
          >
            Join 50,000+ Earners
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
