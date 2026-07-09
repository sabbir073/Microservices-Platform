import type { ReactNode } from "react";

/** Last time any legal document was revised. Update when policies change. */
export const LEGAL_UPDATED = "9 July 2026";
export const LEGAL_CONTACT = "support@earngpt.app";
export const LEGAL_GOVERNING = "Bangladesh";

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

/** A section with an anchor id for a legal document. */
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
