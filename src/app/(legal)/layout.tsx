import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

/** Last time any legal document was revised. Update when policies change. */
export const LEGAL_UPDATED = "9 July 2026";
export const LEGAL_CONTACT = "support@earngpt.app";
export const LEGAL_GOVERNING = "Bangladesh";

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-300">
      <header className="border-b border-white/10 bg-slate-950/60 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="text-lg font-bold text-white">EarnGPT</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">{children}</div>

      <footer className="border-t border-white/10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 flex flex-wrap items-center justify-between gap-4 text-sm text-slate-500">
          <p>© {new Date().getFullYear()} EarnGPT. All rights reserved.</p>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link href="/privacy" className="hover:text-white transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-white transition-colors">
              Terms
            </Link>
            <Link href="/refund" className="hover:text-white transition-colors">
              Refunds
            </Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}

/** Page title + "last updated" header for a legal document. */
export function LegalHeader({
  title,
  intro,
}: {
  title: string;
  intro?: string;
}) {
  return (
    <div className="mb-10">
      <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
        {title}
      </h1>
      <p className="text-xs text-slate-500 mt-2">Last updated: {LEGAL_UPDATED}</p>
      {intro && (
        <p className="text-sm sm:text-base text-slate-400 mt-4 leading-relaxed">
          {intro}
        </p>
      )}
    </div>
  );
}

/** A numbered section with an anchor id. */
export function LegalSection({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="mb-8 scroll-mt-20">
      <h2 className="text-lg sm:text-xl font-bold text-white mb-3">{title}</h2>
      <div className="space-y-3 text-sm sm:text-[15px] leading-relaxed text-slate-300/90">
        {children}
      </div>
    </section>
  );
}
