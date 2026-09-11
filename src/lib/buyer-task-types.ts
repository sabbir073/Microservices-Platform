/**
 * The task types a buyer can be allowed to create.
 *
 * Its own module, with no `server-only` and no Prisma import, so the admin
 * settings form and the server-side `buyer-settings.ts` share ONE list. A
 * hand-copied second list in the client is how the tick-boxes end up offering a
 * type the server then rejects.
 */
export const BUYER_TASK_TYPES = [
  "SOCIAL",
  "VIDEO",
  "CUSTOM",
  "SURVEY",
  "QUIZ",
  "ARTICLE",
  "APPINSTALL",
] as const;

/**
 * What each type needs from the buyer, and what a worker will be asked to do.
 *
 * Kept beside the list so adding a type forces you to say what it is for —
 * a type in the tuple with no explanation becomes an option nobody understands
 * and everybody picks by accident.
 */
export const BUYER_TASK_TYPE_META: Record<
  (typeof BUYER_TASK_TYPES)[number],
  { label: string; blurb: string }
> = {
  SOCIAL: {
    label: "Social",
    blurb: "Follow, like, share or post about you on a social platform.",
  },
  VIDEO: {
    label: "Watch a video",
    blurb:
      "Watch your video for a set time. Watch time is tracked on the server, not claimed by the viewer.",
  },
  CUSTOM: {
    label: "Custom",
    blurb: "Anything else — you write the steps and review the proof.",
  },
  SURVEY: {
    label: "Survey",
    blurb:
      "Ask a set of questions and read the answers. You see every answer and never who gave it — respondents are told that before they start.",
  },
  QUIZ: {
    label: "Quiz",
    blurb:
      "Write questions with a right answer. Workers never receive the answer key — the browser only gets the options, and scoring happens on our server.",
  },
  ARTICLE: {
    label: "Write an article",
    blurb:
      "Commission writing. Every submission is checked against the other submissions on the same task for duplicates and padding — not against the web.",
  },
  APPINSTALL: {
    label: "Install an app",
    blurb:
      "Get your app installed and used. You choose what counts as proof — a level reached or days opened is far harder to fake than one screenshot.",
  },
};

export type BuyerTaskType = (typeof BUYER_TASK_TYPES)[number];
