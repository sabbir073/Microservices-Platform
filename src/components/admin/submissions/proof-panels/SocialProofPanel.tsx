import { ExternalLink, AtSign, Sparkles, Info } from "lucide-react";
import { ImageZoomGallery } from "@/components/admin/image-zoom-gallery";
import { getPlatform, getAction, type SocialConfig } from "@/lib/social-tasks";
import type { PanelSubmission, PanelTask } from "./types";

interface Props {
  submission: PanelSubmission;
  task: PanelTask;
}

interface SocialMetadata {
  socialUsername?: string | null;
  socialGeneratedContent?: string | null;
}

export function SocialProofPanel({ submission, task }: Props) {
  const cfg = (task.socialConfig as SocialConfig | null) ?? null;
  const meta = (submission.metadata as SocialMetadata | null) ?? null;

  const platformKey = cfg?.platform ?? task.socialPlatform ?? null;
  const actionKey = cfg?.action ?? task.socialAction ?? null;
  const platform = platformKey ? getPlatform(platformKey) : null;
  const action =
    platformKey && actionKey ? getAction(platformKey, actionKey) : null;

  const targetUrl =
    (cfg?.fields && cfg.fields.targetUrl) ||
    task.socialUrl ||
    null;

  // Old SOCIAL submissions (pre-fix) had no metadata persisted — show a hint.
  const isLegacy =
    !submission.proof &&
    (!submission.proofImages || submission.proofImages.length === 0) &&
    !meta;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {platform && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-pink-500/10 border border-pink-500/30 text-pink-300">
            {platform.label}
          </span>
        )}
        {action && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-500/10 border border-indigo-500/30 text-indigo-300">
            {action.label}
          </span>
        )}
        {targetUrl && (
          <a
            href={targetUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-white underline-offset-2 hover:underline truncate max-w-md"
            title="Target URL set by admin"
          >
            <ExternalLink className="w-3 h-3 shrink-0" />
            <span className="truncate">Target: {targetUrl}</span>
          </a>
        )}
      </div>

      {isLegacy && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-2.5 text-xs text-amber-300 inline-flex items-start gap-2">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            Legacy submission — no proof was persisted before the v2 update.
          </span>
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

      {meta?.socialUsername && (
        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs bg-gray-800 border border-gray-700 text-gray-200">
          <AtSign className="w-3.5 h-3.5 text-pink-400" />
          <span className="font-mono">{meta.socialUsername}</span>
        </div>
      )}

      {meta?.socialGeneratedContent && (
        <div>
          <p className="text-xs text-gray-500 mb-1 inline-flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-purple-400" />
            AI-generated content user posted:
          </p>
          <div className="rounded-lg bg-purple-500/5 border border-purple-500/20 p-3 text-sm text-gray-200 whitespace-pre-wrap">
            {meta.socialGeneratedContent}
          </div>
        </div>
      )}

      {submission.proofImages && submission.proofImages.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-1.5">Screenshots:</p>
          <ImageZoomGallery images={submission.proofImages} size={72} />
        </div>
      )}
    </div>
  );
}
