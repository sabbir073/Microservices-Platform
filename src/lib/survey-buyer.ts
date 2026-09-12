/**
 * Buyer-run surveys: what the buyer may see of the answers.
 * ─────────────────────────────────────────────────────────
 *
 * SURVEY is the one admin-only task type that is safe to open to buyers: it
 * needs a question builder and an export, and no new money path — completions
 * are charged through `chargeTaskCompletion` exactly like every other type.
 * What it DOES introduce is personal data, because the answers are written by
 * one identifiable person about themselves.
 *
 * ── THE PRIVACY RULE (one rule, enforced in one place) ──────────────────────
 *
 *   A buyer sees EVERY answer, and NEVER who gave it.
 *
 * Aggregate-only would have been the safe choice and a useless product: the
 * whole point of a survey is reading what people actually wrote, and a bar
 * chart of a long-text question is nothing. So per-response rows are exposed —
 * but stripped, here, of everything that ties a row to an account:
 *
 *   - no `userId`, no name, no email, no avatar, no referral code;
 *   - no submission id (it is a live handle an admin screen can resolve to a
 *     person, and it leaks the platform-wide submission ordering);
 *   - no clock time — only the UTC DATE. A to-the-second timestamp can be
 *     lined up against a public feed post or a leaderboard tick and name the
 *     respondent, which defeats everything above;
 *   - no proof screenshot, ever — those routinely contain a profile.
 *
 * What the buyer gets instead is `Respondent N`, a label that is stable for
 * one task (so two answers by the same person stay on one row) and means
 * nothing outside it. It is positional, not derived from the user id, so it
 * cannot be correlated across two of the same buyer's surveys.
 *
 * Free text is the one thing this cannot protect: a respondent who types their
 * own phone number has disclosed it. That is their choice to make, which is
 * why `BUYER_SURVEY_NOTICE` is shown ABOVE the questions, before a single
 * answer is typed — never in a policy page nobody opens. A worker who has not
 * been told is a worker who did not consent.
 *
 * Admins are a different audience and keep the identified view: they review,
 * approve and pay these submissions, and have to be able to answer "who
 * submitted this" for fraud. That path is `/admin/tasks/[id]/responses` and is
 * unchanged. This module is only ever for the buyer-facing side.
 */

import { z } from "zod";
import {
  formatAnswerForDisplay,
  type SurveyAnswers,
  type SurveyConfig,
  type SurveyQuestion,
} from "@/lib/survey-tasks";

/**
 * The survey a buyer posts, bounded so a hostile body cannot send a
 * ten-thousand-question form. The SHAPE rules (at least two options, unique
 * ids, a sane rating scale) stay in `validateSurveyConfig` — the same function
 * the admin builder is checked with, so a buyer survey and an admin survey
 * cannot drift into two dialects of the same JSON.
 *
 * One schema, imported by BOTH the create route and the edit route. Two copies
 * is how an edit ends up accepting something a create refuses.
 */
export const buyerSurveyQuestionSchema = z.object({
  id: z.string().min(1).max(64),
  order: z.number().int().min(0).max(200),
  type: z.enum([
    "SHORT_TEXT",
    "LONG_TEXT",
    "MCQ_SINGLE",
    "MCQ_MULTI",
    "RATING",
    "DROPDOWN",
  ]),
  prompt: z.string().min(1).max(300),
  required: z.boolean(),
  options: z.array(z.string().min(1).max(120)).max(30).optional(),
  scale: z.number().int().min(2).max(10).optional(),
  hint: z.string().max(300).optional(),
  maxLength: z.number().int().min(1).max(5000).optional(),
});

export const buyerSurveySchema = z.object({
  questions: z.array(buyerSurveyQuestionSchema).min(1).max(50),
  introMessage: z.string().max(1000).optional(),
  thankYouMessage: z.string().max(300).optional(),
  randomizeQuestions: z.boolean().optional(),
  shuffleOptions: z.boolean().optional(),
});

export type BuyerSurveyInput = z.infer<typeof buyerSurveySchema>;

/**
 * Turn what the buyer posted into a `SurveyConfig` the existing runner reads.
 *
 * `order` is re-derived from array position rather than trusted, so a body
 * with three questions all claiming `order: 0` cannot scramble the form.
 */
export function buildBuyerSurveyConfig(input: BuyerSurveyInput): SurveyConfig {
  return {
    questions: input.questions.map((q, i) => ({ ...q, order: i })),
    introMessage: input.introMessage ?? "",
    thankYouMessage: input.thankYouMessage || "Thanks for your response!",
    // Never for a buyer survey. A proof screenshot is the one attachment that
    // routinely contains a profile page, and the buyer-facing response view
    // deliberately has no way to show one — see the privacy rule above.
    proofRequirements: { screenshot: false },
    randomizeQuestions: input.randomizeQuestions ?? false,
    shuffleOptions: input.shuffleOptions ?? false,
  };
}

/** Shown to the worker, above the questions, before they answer. */
export const BUYER_SURVEY_NOTICE =
  "This survey was created by an advertiser. They will see your answers, but never your name, your account or when exactly you answered — only the date. Don't type anything into a free-text answer you wouldn't want them to have.";

/** One row of the buyer's view of the responses. Nothing here names anyone. */
export interface BuyerResponseRow {
  /** `Respondent 1…N`. Positional, per task, meaningless anywhere else. */
  respondent: string;
  /** UTC date only — see the privacy rule above. */
  date: string;
  /** Answer per question id, already formatted for display/CSV. */
  answers: Record<string, string>;
}

/** The submission shape this module needs — deliberately narrow. */
export interface SurveySubmissionLike {
  userId: string;
  createdAt: Date | string;
  answers: unknown;
}

export function surveyQuestions(cfg: SurveyConfig | null): SurveyQuestion[] {
  return Array.isArray(cfg?.questions)
    ? [...(cfg.questions as SurveyQuestion[])].sort((a, b) => a.order - b.order)
    : [];
}

/**
 * Strip submissions down to what a buyer may see.
 *
 * Ordered oldest-first so `Respondent 1` is the first person who answered and
 * the numbering does not shuffle every time a new response lands.
 */
export function toBuyerResponseRows(
  cfg: SurveyConfig | null,
  submissions: SurveySubmissionLike[]
): BuyerResponseRow[] {
  const questions = surveyQuestions(cfg);
  const ordered = [...submissions].sort(
    (a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)
  );

  // One label per PERSON, not per row: a survey is one answer per user, but if
  // that ever changes the same respondent must not become two strangers.
  const labels = new Map<string, string>();
  return ordered.map((s) => {
    let label = labels.get(s.userId);
    if (!label) {
      label = `Respondent ${labels.size + 1}`;
      labels.set(s.userId, label);
    }
    const a = (s.answers ?? null) as SurveyAnswers | null;
    const answers: Record<string, string> = {};
    for (const q of questions) {
      answers[q.id] = a ? formatAnswerForDisplay(q, a[q.id]) : "";
    }
    return {
      respondent: label,
      date: new Date(s.createdAt).toISOString().slice(0, 10),
      answers,
    };
  });
}

/** Per-question totals. Counts only — no row here can name anybody. */
export interface BuyerQuestionStat {
  questionId: string;
  type: SurveyQuestion["type"];
  prompt: string;
  required: boolean;
  answeredCount: number;
  /** MCQ_SINGLE | MCQ_MULTI | DROPDOWN */
  options?: { label: string; count: number; pct: number }[];
  /** RATING */
  ratingHistogram?: { value: number; count: number }[];
  ratingAverage?: number;
}

/**
 * Aggregate the answers for the buyer's charts.
 *
 * Done on the structured `answers` JSON rather than on the display strings,
 * because `formatAnswerForDisplay` joins a multi-choice answer with "; " and an
 * option that itself contains a semicolon would be counted as two.
 */
export function aggregateBuyerSurvey(
  cfg: SurveyConfig | null,
  submissions: SurveySubmissionLike[]
): BuyerQuestionStat[] {
  const questions = surveyQuestions(cfg);
  return questions.map((q) => {
    const stat: BuyerQuestionStat = {
      questionId: q.id,
      type: q.type,
      prompt: q.prompt,
      required: q.required,
      answeredCount: 0,
    };
    const counts = new Map<string, number>();
    for (const opt of q.options ?? []) counts.set(opt, 0);

    if (q.type === "MCQ_SINGLE" || q.type === "DROPDOWN") {
      for (const s of submissions) {
        const v = ((s.answers ?? null) as SurveyAnswers | null)?.[q.id];
        if (typeof v === "string" && counts.has(v)) {
          counts.set(v, (counts.get(v) ?? 0) + 1);
          stat.answeredCount++;
        }
      }
    } else if (q.type === "MCQ_MULTI") {
      for (const s of submissions) {
        const v = ((s.answers ?? null) as SurveyAnswers | null)?.[q.id];
        if (Array.isArray(v) && v.length > 0) {
          stat.answeredCount++;
          for (const item of v) {
            if (typeof item === "string" && counts.has(item)) {
              counts.set(item, (counts.get(item) ?? 0) + 1);
            }
          }
        }
      }
    } else if (q.type === "RATING") {
      const max = q.scale ?? 5;
      const hist = new Map<number, number>();
      for (let n = 1; n <= max; n++) hist.set(n, 0);
      let sum = 0;
      for (const s of submissions) {
        const v = ((s.answers ?? null) as SurveyAnswers | null)?.[q.id];
        if (typeof v === "number" && v >= 1 && v <= max) {
          hist.set(v, (hist.get(v) ?? 0) + 1);
          sum += v;
          stat.answeredCount++;
        }
      }
      stat.ratingHistogram = [...hist].map(([value, count]) => ({
        value,
        count,
      }));
      stat.ratingAverage = stat.answeredCount
        ? Math.round((sum / stat.answeredCount) * 100) / 100
        : 0;
      return stat;
    } else {
      for (const s of submissions) {
        const v = ((s.answers ?? null) as SurveyAnswers | null)?.[q.id];
        if (typeof v === "string" && v.trim()) stat.answeredCount++;
      }
      return stat;
    }

    const total = stat.answeredCount || 1;
    stat.options = [...counts].map(([label, count]) => ({
      label,
      count,
      pct: Math.round((count / total) * 100),
    }));
    return stat;
  });
}

/** Headers for the buyer CSV: the pseudonym, the date, then the prompts. */
export function buyerCsvHeaders(cfg: SurveyConfig | null): string[] {
  return ["Respondent", "Date", ...surveyQuestions(cfg).map((q) => q.prompt)];
}

/** One CSV row per response, in the same column order as the headers. */
export function buyerCsvRow(
  cfg: SurveyConfig | null,
  row: BuyerResponseRow
): string[] {
  return [
    row.respondent,
    row.date,
    ...surveyQuestions(cfg).map((q) => row.answers[q.id] ?? ""),
  ];
}
