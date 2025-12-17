"use client";

import Link from "next/link";
import { Sparkles, ArrowRight, Gift, Shield, CheckCircle } from "lucide-react";

export function CTA() {
  return (
    <section className="py-20 sm:py-28 bg-gray-900 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-8 sm:p-12 lg:p-16 rounded-3xl bg-gray-800/50 border border-gray-700 backdrop-blur-sm">
          <div className="text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 mb-8">
              <Gift className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-medium text-amber-400">
                Get 500 Bonus Points on Sign Up!
              </span>
            </div>

            {/* Heading */}
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
              Ready to Start{" "}
              <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                Earning?
              </span>
            </h2>

            {/* Description */}
            <p className="text-lg text-gray-400 mb-10 max-w-xl mx-auto">
              Join over 50,000 users who are already earning real money with EarnGPT.
              Sign up today and get 500 bonus points instantly!
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
              <Link
                href="/register"
                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                <Sparkles className="w-5 h-5" />
                Create Free Account
              </Link>
              <Link
                href="/login"
                className="w-full sm:w-auto px-8 py-4 bg-gray-700 text-white font-semibold rounded-xl hover:bg-gray-600 transition-colors flex items-center justify-center gap-2 border border-gray-600"
              >
                I Have an Account
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>

            {/* Trust Badges */}
            <div className="flex flex-wrap items-center justify-center gap-6 text-gray-500">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                <span className="text-sm">Secure Platform</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                <span className="text-sm">Verified Payouts</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                <span className="text-sm">Bank-Level Security</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
