import Link from "next/link";
import { Lock, ArrowUpRight } from "lucide-react";

/**
 * Shown when a section is disabled for the user's plan (or an admin per-user
 * override turned it off). Mirrors the hidden nav item with a clear upgrade CTA.
 */
export function FeatureLock({ title }: { title: string }) {
  return (
    <div className="max-w-md mx-auto px-4 py-10">
      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6 text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 ring-1 ring-amber-500/20 flex items-center justify-center mb-4">
          <Lock className="w-7 h-7 text-amber-400" />
        </div>
        <h1 className="text-lg font-bold text-white">{title} is not available</h1>
        <p className="text-sm text-gray-400 mt-1">
          {title} isn&apos;t included in your current plan. Upgrade to unlock it.
        </p>
        <Link
          href="/packages"
          className="mt-4 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-linear-to-r from-indigo-500 to-purple-600 text-white text-sm font-bold active:scale-[0.97] transition-transform"
        >
          View plans
          <ArrowUpRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
