import { ImageZoomGallery } from "@/components/admin/image-zoom-gallery";
import type { PanelSubmission } from "./types";

interface Props {
  submission: PanelSubmission;
}

export function GenericProofPanel({ submission }: Props) {
  const hasProof = !!submission.proof;
  const hasImages =
    submission.proofImages && submission.proofImages.length > 0;
  const hasAnswers =
    submission.answers !== null && submission.answers !== undefined;
  const hasMetadata =
    submission.metadata !== null && submission.metadata !== undefined;

  if (!hasProof && !hasImages && !hasAnswers && !hasMetadata) {
    return (
      <div className="rounded-lg bg-gray-950 border border-gray-800 p-3 text-xs text-gray-500">
        No proof submitted.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {hasProof && (
        <div>
          <p className="text-xs text-gray-500 mb-1">Proof:</p>
          <p className="text-sm text-gray-200 bg-gray-800/50 rounded-lg p-3 whitespace-pre-wrap break-words">
            {submission.proof}
          </p>
        </div>
      )}

      {hasImages && (
        <div>
          <p className="text-xs text-gray-500 mb-1.5">Screenshots:</p>
          <ImageZoomGallery images={submission.proofImages} size={72} />
        </div>
      )}

      {hasAnswers && (
        <details className="rounded-lg bg-gray-950 border border-gray-800">
          <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold text-gray-400 select-none">
            Raw answers (JSON)
          </summary>
          <pre className="px-3 pb-3 pt-1 text-[11px] text-gray-500 overflow-x-auto">
            {JSON.stringify(submission.answers, null, 2)}
          </pre>
        </details>
      )}

      {hasMetadata && (
        <details className="rounded-lg bg-gray-950 border border-gray-800">
          <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold text-gray-400 select-none">
            Metadata (JSON)
          </summary>
          <pre className="px-3 pb-3 pt-1 text-[11px] text-gray-500 overflow-x-auto">
            {JSON.stringify(submission.metadata, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
