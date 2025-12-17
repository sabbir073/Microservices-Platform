"use client";

import {
  Video,
  Gift,
  Users,
  Wallet,
  Shield,
  Zap,
  Trophy,
  Globe,
  Clock,
  CreditCard,
  Smartphone,
  Headphones,
} from "lucide-react";

const features = [
  {
    icon: Video,
    title: "Watch & Earn",
    description: "Earn points by watching short videos and ads. Simple and fun.",
    gradient: "from-indigo-500 to-indigo-600",
  },
  {
    icon: Gift,
    title: "Daily Rewards",
    description: "Log in daily to claim free bonuses. Keep your streak going!",
    gradient: "from-amber-500 to-orange-500",
  },
  {
    icon: Users,
    title: "10-Level Referral",
    description: "Earn up to 10 levels deep from your referrals' earnings.",
    gradient: "from-purple-500 to-pink-500",
  },
  {
    icon: Wallet,
    title: "Multiple Payouts",
    description: "Withdraw via bKash, Nagad, Rocket, Binance, or PayPal.",
    gradient: "from-green-500 to-emerald-500",
  },
  {
    icon: Shield,
    title: "Secure & Trusted",
    description: "Bank-level security protects your data and earnings.",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    icon: Zap,
    title: "Instant Tasks",
    description: "Complete surveys, app installs, and social tasks instantly.",
    gradient: "from-yellow-500 to-amber-500",
  },
  {
    icon: Trophy,
    title: "Leaderboard",
    description: "Compete with others and win exclusive prizes weekly.",
    gradient: "from-amber-500 to-yellow-500",
  },
  {
    icon: Globe,
    title: "Global Access",
    description: "Available worldwide with localized payment options.",
    gradient: "from-indigo-500 to-blue-500",
  },
  {
    icon: Clock,
    title: "24/7 Earning",
    description: "Tasks available round the clock. Earn anytime, anywhere.",
    gradient: "from-pink-500 to-rose-500",
  },
  {
    icon: CreditCard,
    title: "Low Minimum",
    description: "Start withdrawing from just $5. No long waits.",
    gradient: "from-emerald-500 to-teal-500",
  },
  {
    icon: Smartphone,
    title: "Mobile First",
    description: "Optimized for mobile. Earn on the go seamlessly.",
    gradient: "from-cyan-500 to-blue-500",
  },
  {
    icon: Headphones,
    title: "24/7 Support",
    description: "Get help anytime from our dedicated support team.",
    gradient: "from-orange-500 to-red-500",
  },
];

export function Features() {
  return (
    <section id="features" className="py-20 sm:py-28 bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-medium mb-4">
            Features
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            Everything You Need to{" "}
            <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Earn More
            </span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">
            Powerful features designed to maximize your earning potential.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {features.map((feature, i) => (
            <div
              key={i}
              className="group p-6 rounded-2xl bg-gray-900 border border-gray-800 hover:border-indigo-500/50 transition-all duration-300"
            >
              {/* Icon */}
              <div
                className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4`}
              >
                <feature.icon className="w-6 h-6 text-white" />
              </div>

              {/* Content */}
              <h3 className="text-lg font-semibold text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
