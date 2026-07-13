"use client";

import { useState } from "react";
import Link from "next/link";
import { ShieldCheck, X } from "lucide-react";

const DISMISS_KEY = "kyc_prompt_dismissed";

/**
 * Nudge shown once the profile is complete but the user hasn't verified their
 * identity — KYC is required to withdraw (not to earn). Dismissible for the
 * session; reappears next visit until KYC is submitted.
 */
export function KycPromptBanner() {
  const [hidden, setHidden] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  });

  if (hidden) return null;

  return (
    <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3.5">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-indigo-500/15 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-4.5 h-4.5 text-indigo-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">
            Verify your identity to withdraw
          </p>
          <p className="text-xs text-indigo-200/80 mt-0.5">
            Your profile is complete. Verify your identity (KYC) to unlock
            withdrawals — earning tasks are unaffected.
          </p>
          <Link
            href="/kyc"
            className="inline-flex items-center gap-1.5 mt-2.5 px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold active:scale-[0.97] transition-transform"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Complete KYC
          </Link>
        </div>
        <button
          onClick={() => {
            try {
              sessionStorage.setItem(DISMISS_KEY, "1");
            } catch {
              /* ignore */
            }
            setHidden(true);
          }}
          aria-label="Dismiss"
          className="p-1 rounded-lg text-indigo-300/70 hover:text-white shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
