import {
  hasInstructions,
  isHtmlInstructions,
  legacySteps,
  sanitizeInstructionsHtml,
} from "@/lib/task-instructions";
import { OFFER_RICHTEXT_CLASS } from "@/lib/offers";

/**
 * The instructions block, wherever a task is shown.
 *
 * One component for all five surfaces (social, article, manual, proxy, and the
 * admin detail page) because they were five copies of the same
 * `.split("\n").map(<li>)` and would otherwise have drifted the moment rich
 * text arrived at some of them and not others.
 *
 * Renders whichever shape is stored — see `lib/task-instructions`. Old tasks
 * keep the numbered steps they have always had; new ones get their formatting.
 */
export function TaskInstructions({
  value,
  title = "Steps",
  className = "",
}: {
  value: string | null | undefined;
  title?: string | null;
  /**
   * Replaces the container classes rather than appending to them — the callers
   * do not agree on the surround (some use gray-900/p-4, some gray-950/p-3),
   * and appending would leave two competing background classes whose winner
   * depends on stylesheet order.
   */
  className?: string;
}) {
  if (!hasInstructions(value)) return null;

  return (
    <div className={className || "rounded-xl bg-gray-900 border border-gray-800 p-4"}>
      {title && (
        <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-2">
          {title}
        </p>
      )}
      {isHtmlInstructions(value) ? (
        <div
          className={`${OFFER_RICHTEXT_CLASS} text-sm`}
          // Sanitised immediately above. Staff-authored, but read by every user,
          // so it is treated as untrusted all the same.
          dangerouslySetInnerHTML={{
            __html: sanitizeInstructionsHtml(value as string),
          }}
        />
      ) : (
        <ol className="space-y-1 text-sm text-gray-300 list-decimal pl-4">
          {legacySteps(value).map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ol>
      )}
    </div>
  );
}
