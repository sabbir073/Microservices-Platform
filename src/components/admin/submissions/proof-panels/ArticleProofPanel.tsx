import { ExternalLink, Key, AlertTriangle, FileText } from "lucide-react";
import { ImageZoomGallery } from "@/components/admin/image-zoom-gallery";
import { DurationCard } from "../duration-card";
import type { ArticleConfig } from "@/lib/article-tasks";
import type { PanelSubmission, PanelTask } from "./types";

interface Props {
  submission: PanelSubmission;
  task: PanelTask;
}

interface ArticleMetadata {
  articleUniqueKeyMismatch?: boolean;
  articleSubmittedUniqueKey?: string | null;
}

export function ArticleProofPanel({ submission, task }: Props) {
  const cfg = (task.articleConfig as ArticleConfig | null) ?? null;
  const meta = (submission.metadata as ArticleMetadata | null) ?? null;
  const requiredSec = task.duration ?? 0;
  const requiresKey = !!cfg?.proofRequirements?.uniqueKey;
  const keyMismatch = !!meta?.articleUniqueKeyMismatch;

  return (
    <div className="space-y-3">
      {cfg?.links && cfg.links.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-1.5">Required article links:</p>
          <div className="flex flex-wrap gap-1.5">
            {cfg.links
              .filter((l) => l.url)
              .map((l, i) => (
                <a
                  key={i}
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-blue-500/10 border border-blue-500/30 text-blue-300 hover:bg-blue-500/20 transition-colors max-w-xs truncate"
                  title={l.url}
                >
                  <FileText className="w-3 h-3 shrink-0" />
                  <span className="truncate">{l.label || l.url}</span>
                  <ExternalLink className="w-3 h-3 shrink-0 opacity-60" />
                </a>
              ))}
          </div>
        </div>
      )}

      {submission.proof && (
        <div>
          <p className="text-xs text-gray-500 mb-1">Proof URL submitted:</p>
          <a
            href={submission.proof}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-sm text-indigo-400 hover:text-indigo-300 break-all max-w-full"
          >
            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{submission.proof}</span>
          </a>
        </div>
      )}

      <div className="flex flex-wrap items-start gap-3">
        {requiredSec > 0 && (
          <DurationCard
            startedAt={submission.createdAt}
            submittedAt={submission.updatedAt}
            requiredSeconds={requiredSec}
            verb="Read"
          />
        )}

        {requiresKey && (
          <div
            className={`rounded-lg border p-3 inline-flex items-start gap-2 text-xs font-semibold ${
              keyMismatch
                ? "bg-red-500/10 border-red-500/30 text-red-300"
                : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
            }`}
          >
            {keyMismatch ? (
              <AlertTriangle className="w-4 h-4 mt-0.5" />
            ) : (
              <Key className="w-4 h-4 mt-0.5" />
            )}
            <div>
              <p className="text-[10px] uppercase tracking-wider opacity-80">
                Unique Key
              </p>
              <p>{keyMismatch ? "Mismatched" : "Verified"}</p>
              {keyMismatch && meta?.articleSubmittedUniqueKey && (
                <p className="text-[10px] opacity-90 mt-0.5">
                  User submitted:{" "}
                  <span className="font-mono">
                    &quot;{meta.articleSubmittedUniqueKey}&quot;
                  </span>
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {submission.proofImages && submission.proofImages.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-1.5">Screenshots:</p>
          <ImageZoomGallery images={submission.proofImages} size={72} />
        </div>
      )}
    </div>
  );
}
