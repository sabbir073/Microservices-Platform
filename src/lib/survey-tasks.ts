/**
 * Survey Task Configuration
 * --------------------------
 * Survey tasks ask users to answer a set of questions. The admin builds the
 * question list (mix of text inputs, multiple choice, rating, dropdown).
 * Responses are stored in TaskSubmission.answers as a Record<questionId, answer>
 * keyed by stable question ids — so renaming a question's prompt is safe and
 * never invalidates historical responses.
 *
 * Approval is always manual: surveys ignore Task.autoApprove (forced PENDING).
 * Each user can submit a survey once (Task.totalLimit = Task.dailyLimit = 1).
 */

export type SurveyQuestionType =
  | "SHORT_TEXT"
  | "LONG_TEXT"
  | "MCQ_SINGLE"
  | "MCQ_MULTI"
  | "RATING"
  | "DROPDOWN";

export interface SurveyQuestion {
  /** Stable id (cuid). Used as the key in TaskSubmission.answers. Never reuse or rewrite. */
  id: string;
  order: number;
  type: SurveyQuestionType;
  prompt: string;
  required: boolean;
  /** MCQ_SINGLE | MCQ_MULTI | DROPDOWN */
  options?: string[];
  /** RATING: max value (1..scale). Default 5. */
  scale?: number;
  /** Helper text shown under the field. */
  hint?: string;
  /** SHORT_TEXT | LONG_TEXT — soft cap on input length. */
  maxLength?: number;
}

export interface SurveyConfig {
  questions: SurveyQuestion[];
  introMessage?: string;
  thankYouMessage?: string;
  proofRequirements: {
    /** Optional screenshot upload alongside answers. */
    screenshot: boolean;
  };
  /** Shuffle question order per user. */
  randomizeQuestions: boolean;
  /** Shuffle MCQ/dropdown option order per user. */
  shuffleOptions: boolean;
}

export const SURVEY_QUESTION_TYPE_LABEL: Record<SurveyQuestionType, string> = {
  SHORT_TEXT: "Short Text",
  LONG_TEXT: "Long Text",
  MCQ_SINGLE: "Multiple Choice (one answer)",
  MCQ_MULTI: "Multiple Choice (many answers)",
  RATING: "Rating",
  DROPDOWN: "Dropdown",
};

/** Tiny non-cryptographic id, good enough for question ids. */
function tinyId(): string {
  return (
    Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
  );
}

export function emptyQuestion(type: SurveyQuestionType): SurveyQuestion {
  const base: SurveyQuestion = {
    id: tinyId(),
    order: 0,
    type,
    prompt: "",
    required: true,
  };
  switch (type) {
    case "SHORT_TEXT":
      return { ...base, maxLength: 200 };
    case "LONG_TEXT":
      return { ...base, maxLength: 1000 };
    case "MCQ_SINGLE":
    case "MCQ_MULTI":
    case "DROPDOWN":
      return { ...base, options: ["Option 1", "Option 2"] };
    case "RATING":
      return { ...base, scale: 5 };
  }
}

export function emptySurveyConfig(): SurveyConfig {
  return {
    questions: [],
    introMessage: "",
    thankYouMessage: "Thanks for your response!",
    proofRequirements: { screenshot: false },
    randomizeQuestions: false,
    shuffleOptions: false,
  };
}

export function validateSurveyConfig(
  cfg: SurveyConfig
): { ok: boolean; error?: string } {
  if (!cfg || !Array.isArray(cfg.questions)) {
    return { ok: false, error: "Survey is missing questions" };
  }
  if (cfg.questions.length === 0) {
    return { ok: false, error: "At least one question is required" };
  }
  const seenIds = new Set<string>();
  for (const q of cfg.questions) {
    if (!q.id || typeof q.id !== "string") {
      return { ok: false, error: "Each question needs a stable id" };
    }
    if (seenIds.has(q.id)) {
      return { ok: false, error: `Duplicate question id: ${q.id}` };
    }
    seenIds.add(q.id);
    if (!q.prompt || !q.prompt.trim()) {
      return { ok: false, error: "Every question needs a prompt" };
    }
    if (q.type === "MCQ_SINGLE" || q.type === "MCQ_MULTI" || q.type === "DROPDOWN") {
      const opts = (q.options ?? []).map((o) => o.trim()).filter(Boolean);
      if (opts.length < 2) {
        return {
          ok: false,
          error: `"${q.prompt}" needs at least 2 options`,
        };
      }
      const dupes = new Set<string>();
      for (const o of opts) {
        if (dupes.has(o.toLowerCase())) {
          return {
            ok: false,
            error: `"${q.prompt}" has duplicate options`,
          };
        }
        dupes.add(o.toLowerCase());
      }
    }
    if (q.type === "RATING") {
      const s = q.scale ?? 5;
      if (!Number.isFinite(s) || s < 2 || s > 10) {
        return {
          ok: false,
          error: `"${q.prompt}" rating scale must be between 2 and 10`,
        };
      }
    }
  }
  return { ok: true };
}

export type SurveyAnswerValue =
  | string // SHORT_TEXT, LONG_TEXT, MCQ_SINGLE (= chosen option label), DROPDOWN
  | string[] // MCQ_MULTI (= array of chosen option labels)
  | number // RATING (= 1..scale)
  | null
  | undefined;

export type SurveyAnswers = Record<string, SurveyAnswerValue>;

export function validateAnswers(
  cfg: SurveyConfig,
  answers: SurveyAnswers
): { ok: boolean; error?: string; missing?: string[] } {
  if (!cfg || !Array.isArray(cfg.questions)) {
    return { ok: false, error: "Invalid survey configuration" };
  }
  const a = answers ?? {};
  const missing: string[] = [];
  for (const q of cfg.questions) {
    const v = a[q.id];
    const present = isAnswered(q, v);
    if (q.required && !present) {
      missing.push(q.prompt);
      continue;
    }
    if (!present) continue;
    const shape = checkShape(q, v);
    if (!shape.ok) return shape;
  }
  if (missing.length > 0) {
    return {
      ok: false,
      error: `Required ${missing.length === 1 ? "question is" : "questions are"} unanswered`,
      missing,
    };
  }
  return { ok: true };
}

function isAnswered(q: SurveyQuestion, v: SurveyAnswerValue): boolean {
  if (v === undefined || v === null) return false;
  if (q.type === "MCQ_MULTI") {
    return Array.isArray(v) && v.length > 0;
  }
  if (q.type === "RATING") {
    return typeof v === "number" && Number.isFinite(v);
  }
  if (typeof v === "string") return v.trim().length > 0;
  return false;
}

function checkShape(
  q: SurveyQuestion,
  v: SurveyAnswerValue
): { ok: boolean; error?: string } {
  switch (q.type) {
    case "SHORT_TEXT":
    case "LONG_TEXT": {
      if (typeof v !== "string") {
        return { ok: false, error: `"${q.prompt}" expects text` };
      }
      const max = q.maxLength ?? (q.type === "SHORT_TEXT" ? 200 : 1000);
      if (v.length > max) {
        return {
          ok: false,
          error: `"${q.prompt}" answer is too long (max ${max} characters)`,
        };
      }
      return { ok: true };
    }
    case "MCQ_SINGLE":
    case "DROPDOWN": {
      if (typeof v !== "string") {
        return { ok: false, error: `"${q.prompt}" expects a single choice` };
      }
      const opts = q.options ?? [];
      if (!opts.includes(v)) {
        return {
          ok: false,
          error: `"${q.prompt}" answer is not a valid option`,
        };
      }
      return { ok: true };
    }
    case "MCQ_MULTI": {
      if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) {
        return { ok: false, error: `"${q.prompt}" expects a list of choices` };
      }
      const opts = q.options ?? [];
      const bad = v.find((x) => !opts.includes(x));
      if (bad) {
        return {
          ok: false,
          error: `"${q.prompt}" includes an invalid option: ${bad}`,
        };
      }
      const seen = new Set<string>();
      for (const x of v) {
        if (seen.has(x)) {
          return { ok: false, error: `"${q.prompt}" has duplicate selections` };
        }
        seen.add(x);
      }
      return { ok: true };
    }
    case "RATING": {
      if (typeof v !== "number" || !Number.isFinite(v)) {
        return { ok: false, error: `"${q.prompt}" expects a number` };
      }
      const max = q.scale ?? 5;
      if (v < 1 || v > max || !Number.isInteger(v)) {
        return {
          ok: false,
          error: `"${q.prompt}" rating must be an integer between 1 and ${max}`,
        };
      }
      return { ok: true };
    }
  }
}

/** Format an answer for human display (admin review, CSV export). */
export function formatAnswerForDisplay(
  q: SurveyQuestion,
  v: SurveyAnswerValue
): string {
  if (v === undefined || v === null) return "";
  if (q.type === "MCQ_MULTI") {
    return Array.isArray(v) ? v.join("; ") : "";
  }
  if (q.type === "RATING") {
    return typeof v === "number" ? String(v) : "";
  }
  return typeof v === "string" ? v : "";
}
