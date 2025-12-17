"use client";

import { Check, Zap, Star, Sparkles, Crown } from "lucide-react";
import Link from "next/link";

const packages = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Perfect for getting started",
    icon: Zap,
    features: [
      "5 tasks per day",
      "Basic video rewards",
      "3-level referral bonus",
      "$10 minimum withdrawal",
      "5% withdrawal fee",
      "Email support",
    ],
    cta: "Start Free",
    popular: false,
    gradient: "from-gray-600 to-gray-700",
  },
  {
    name: "Basic",
    price: "$4.99",
    period: "/month",
    description: "For regular earners",
    icon: Star,
    features: [
      "20 tasks per day",
      "Premium video rewards",
      "5-level referral bonus",
      "$5 minimum withdrawal",
      "3% withdrawal fee",
      "Priority support",
      "Exclusive tasks",
    ],
    cta: "Get Basic",
    popular: false,
    gradient: "from-indigo-500 to-indigo-600",
  },
  {
    name: "Standard",
    price: "$9.99",
    period: "/month",
    description: "Most popular choice",
    icon: Sparkles,
    features: [
      "50 tasks per day",
      "2x video rewards",
      "7-level referral bonus",
      "$3 minimum withdrawal",
      "2% withdrawal fee",
      "24/7 priority support",
      "VIP tasks access",
      "Weekly bonus rewards",
    ],
    cta: "Get Standard",
    popular: true,
    gradient: "from-purple-500 to-pink-500",
  },
  {
    name: "Premium",
    price: "$19.99",
    period: "/month",
    description: "For serious earners",
    icon: Crown,
    features: [
      "Unlimited tasks",
      "3x video rewards",
      "10-level referral bonus",
      "$1 minimum withdrawal",
      "0% withdrawal fee",
      "Dedicated manager",
      "Exclusive VIP tasks",
      "Daily bonus rewards",
      "Early feature access",
    ],
    cta: "Go Premium",
    popular: false,
    gradient: "from-amber-500 to-orange-500",
  },
];

export function Packages() {
  return (
    <section id="pricing" className="py-20 sm:py-28 bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-medium mb-4">
            Pricing
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            Choose Your{" "}
            <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
              Perfect Plan
            </span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">
            Upgrade to unlock more earning opportunities and exclusive benefits.
          </p>
        </div>

        {/* Pricing Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 lg:gap-8">
          {packages.map((pkg, i) => (
            <div
              key={i}
              className={`relative rounded-2xl p-6 lg:p-8 transition-all duration-300 ${
                pkg.popular
                  ? "bg-gradient-to-b from-purple-500/10 to-pink-500/10 border-2 border-purple-500 scale-105"
                  : "bg-gray-900 border border-gray-800 hover:border-gray-700"
              }`}
            >
              {/* Popular Badge */}
              {pkg.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-4 py-1 rounded-full bg-purple-500 text-white text-xs font-bold uppercase">
                    Most Popular
                  </span>
                </div>
              )}

              {/* Icon */}
              <div
                className={`w-12 h-12 rounded-xl bg-gradient-to-br ${pkg.gradient} flex items-center justify-center mb-4`}
              >
                <pkg.icon className="w-6 h-6 text-white" />
              </div>

              {/* Name & Price */}
              <h3 className="text-xl font-bold text-white mb-1">{pkg.name}</h3>
              <p className="text-sm text-gray-500 mb-4">{pkg.description}</p>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold text-white">{pkg.price}</span>
                <span className="text-gray-500">{pkg.period}</span>
              </div>

              {/* Features */}
              <ul className="space-y-3 mb-8">
                {pkg.features.map((feature, j) => (
                  <li key={j} className="flex items-start gap-3 text-sm text-gray-400">
                    <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA Button */}
              <Link
                href="/register"
                className={`block w-full py-3 text-center font-semibold rounded-xl transition-all ${
                  pkg.popular
                    ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90"
                    : "bg-gray-800 text-white hover:bg-gray-700 border border-gray-700"
                }`}
              >
                {pkg.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* Money Back Guarantee */}
        <div className="text-center mt-12">
          <p className="text-gray-500 text-sm">
            All paid plans come with a{" "}
            <span className="text-green-400 font-medium">7-day money-back guarantee</span>.
            No questions asked.
          </p>
        </div>
      </div>
    </section>
  );
}
