import { Construction, ArrowRight } from "lucide-react";
import Link from "next/link";

interface ComingSoonProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  phase?: string;
  features?: string[];
}

/**
 * Placeholder page for admin modules that have a route + sidebar entry
 * but full implementation is queued for a later phase.
 *
 * Used to prevent 404s while the 33-module sidebar is wired up.
 */
export function AdminComingSoon({
  title,
  description,
  icon,
  phase,
  features,
}: ComingSoonProps) {
  return (
    <div className="max-w-3xl mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">{title}</h1>
        {description && (
          <p className="mt-2 text-slate-400">{description}</p>
        )}
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-800 p-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
            {icon ?? <Construction className="w-7 h-7" />}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">
              Module under construction
            </h2>
            {phase && (
              <p className="text-sm text-slate-400">
                Scheduled for{" "}
                <span className="text-amber-400 font-medium">{phase}</span>
              </p>
            )}
          </div>
        </div>

        {features && features.length > 0 && (
          <div className="border-t border-slate-700 pt-6">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Planned features
            </p>
            <ul className="space-y-2">
              {features.map((feature, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                  <ArrowRight className="w-4 h-4 mt-0.5 text-blue-400 shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-slate-700 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            See <code className="text-slate-400">md/admin_oo.md</code> for full
            spec.
          </p>
          <Link
            href="/admin"
            className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
          >
            Back to dashboard
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
