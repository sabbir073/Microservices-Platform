"use client";

import { Star } from "lucide-react";
import {
  type SurveyConfig,
  type SurveyAnswers,
  type SurveyQuestion,
  formatAnswerForDisplay,
  SURVEY_QUESTION_TYPE_LABEL,
} from "@/lib/survey-tasks";

interface Props {
  config: SurveyConfig | null | undefined;
  answers: SurveyAnswers | null | undefined;
}

export function SurveyAnswerDetail({ config, answers }: Props) {
  if (!config || !Array.isArray(config.questions) || config.questions.length === 0) {
    return (
      <div className="rounded-lg bg-gray-950 border border-gray-800 p-3 text-xs text-gray-500">
        Survey has no questions configured.
      </div>
    );
  }

  const a = answers ?? {};
  const sorted = [...config.questions].sort((x, y) => x.order - y.order);

  // Track answers whose questionId is no longer in the config (orphaned).
  const knownIds = new Set(sorted.map((q) => q.id));
  const orphans = Object.entries(a).filter(([k]) => !knownIds.has(k));

  return (
    <div className="space-y-3">
      <div className="text-xs uppercase tracking-wider text-gray-500 font-bold">
        Survey Responses
      </div>
      <div className="space-y-2">
        {sorted.map((q, i) => (
          <AnswerRow key={q.id} index={i} q={q} value={a[q.id]} />
        ))}
      </div>
      {orphans.length > 0 && (
        <div className="rounded-lg bg-amber-500/5 border border-amber-500/30 p-3">
          <p className="text-[11px] uppercase tracking-wider text-amber-400 font-bold mb-1.5">
            Removed questions
          </p>
          <p className="text-[11px] text-amber-200/80 mb-2">
            These answers were collected before a question was deleted from the
            survey. Kept here so data isn&apos;t lost.
          </p>
          <ul className="space-y-1 text-xs text-gray-300">
            {orphans.map(([k, v]) => (
              <li key={k}>
                <span className="font-mono text-amber-300/80">{k}</span>:{" "}
                {Array.isArray(v) ? v.join("; ") : String(v ?? "")}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function AnswerRow({
  index,
  q,
  value,
}: {
  index: number;
  q: SurveyQuestion;
  value: unknown;
}) {
  return (
    <div className="rounded-lg bg-gray-950 border border-gray-800 p-3">
      <div className="flex items-start gap-2 mb-1">
        <span className="text-xs text-gray-500 font-mono shrink-0 w-6 text-right">
          #{index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white">{q.prompt}</p>
          <span className="inline-block mt-0.5 text-[10px] uppercase tracking-wider text-gray-500 font-bold">
            {SURVEY_QUESTION_TYPE_LABEL[q.type]}
            {q.required && <span className="text-red-400 ml-1">*</span>}
          </span>
        </div>
      </div>
      <div className="ml-8">
        <AnswerValue q={q} value={value} />
      </div>
    </div>
  );
}

function AnswerValue({ q, value }: { q: SurveyQuestion; value: unknown }) {
  const isEmpty =
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0);

  if (isEmpty) {
    return (
      <span className="text-xs text-gray-500 italic">No answer provided</span>
    );
  }

  if (q.type === "RATING" && typeof value === "number") {
    const max = q.scale ?? 5;
    return (
      <div className="inline-flex items-center gap-0.5">
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <Star
            key={n}
            className={`w-4 h-4 ${
              value >= n ? "text-amber-400 fill-amber-400" : "text-gray-700"
            }`}
          />
        ))}
        <span className="ml-2 text-xs text-gray-300 tabular-nums">
          {value} / {max}
        </span>
      </div>
    );
  }

  if (q.type === "MCQ_MULTI" && Array.isArray(value)) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {(value as string[]).map((v) => (
          <span
            key={v}
            className="inline-flex items-center px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 text-xs border border-indigo-500/30"
          >
            {v}
          </span>
        ))}
      </div>
    );
  }

  if (q.type === "MCQ_SINGLE" || q.type === "DROPDOWN") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 text-xs border border-indigo-500/30">
        {String(value)}
      </span>
    );
  }

  // SHORT_TEXT / LONG_TEXT
  return (
    <p className="text-sm text-gray-200 whitespace-pre-wrap break-words">
      {formatAnswerForDisplay(q, value as string)}
    </p>
  );
}
