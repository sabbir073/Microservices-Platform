import { CheckCircle2, XCircle, Circle, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PanelSubmission, PanelTask } from "./types";

interface Props {
  submission: PanelSubmission;
  task: PanelTask;
}

interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
  imageUrl?: string;
}

export function QuizProofPanel({ submission, task }: Props) {
  const questions = (task.questions as QuizQuestion[] | null) ?? [];
  const userAnswers = (submission.answers as number[] | null) ?? [];
  const score = submission.score;

  if (questions.length === 0) {
    return (
      <div className="rounded-lg bg-gray-950 border border-gray-800 p-3 text-xs text-gray-500">
        No questions configured on this quiz.
      </div>
    );
  }

  const correctCount = questions.reduce((acc, q, i) => {
    return acc + (userAnswers[i] === q.correctAnswer ? 1 : 0);
  }, 0);

  const scoreTone =
    score === null
      ? "bg-gray-800 border-gray-700 text-gray-400"
      : score >= 80
      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
      : score >= 50
      ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
      : "bg-red-500/10 border-red-500/30 text-red-300";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-sm font-bold border tabular-nums",
            scoreTone
          )}
        >
          <HelpCircle className="w-4 h-4" />
          {score !== null ? `${score}%` : "—"}
        </span>
        <span className="text-xs text-gray-400 tabular-nums">
          {correctCount} / {questions.length} correct
        </span>
      </div>

      <ol className="space-y-2">
        {questions.map((q, qIdx) => {
          const userPick = userAnswers[qIdx];
          const isCorrect =
            typeof userPick === "number" && userPick === q.correctAnswer;
          const noAnswer = typeof userPick !== "number";
          return (
            <li
              key={qIdx}
              className={cn(
                "rounded-lg border p-3 space-y-2",
                noAnswer
                  ? "bg-gray-950 border-gray-800"
                  : isCorrect
                  ? "bg-emerald-500/5 border-emerald-500/30"
                  : "bg-red-500/5 border-red-500/30"
              )}
            >
              <p className="text-sm font-semibold text-white flex items-start gap-2">
                <span className="text-xs text-gray-500 tabular-nums mt-0.5 shrink-0">
                  Q{qIdx + 1}.
                </span>
                <span className="flex-1">{q.question}</span>
              </p>
              <div className="space-y-1 ml-7">
                {q.options.map((opt, oIdx) => {
                  const isUserPick = userPick === oIdx;
                  const isCorrectOpt = q.correctAnswer === oIdx;
                  return (
                    <div
                      key={oIdx}
                      className={cn(
                        "flex items-center gap-2 text-xs rounded-md px-2 py-1.5",
                        isCorrectOpt
                          ? "bg-emerald-500/10 text-emerald-200"
                          : isUserPick
                          ? "bg-red-500/10 text-red-200"
                          : "text-gray-400"
                      )}
                    >
                      {isCorrectOpt ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : isUserPick ? (
                        <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      ) : (
                        <Circle className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                      )}
                      <span className="flex-1">{opt}</span>
                      {isUserPick && (
                        <span className="text-[10px] uppercase tracking-wider font-bold opacity-80">
                          User pick
                        </span>
                      )}
                      {isCorrectOpt && (
                        <span className="text-[10px] uppercase tracking-wider font-bold opacity-80">
                          Correct
                        </span>
                      )}
                    </div>
                  );
                })}
                {noAnswer && (
                  <p className="text-[11px] text-gray-500 italic">
                    User didn&apos;t answer this question
                  </p>
                )}
              </div>
              {q.explanation && (
                <p className="text-[11px] text-gray-500 italic ml-7">
                  💡 {q.explanation}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
