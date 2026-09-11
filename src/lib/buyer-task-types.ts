/**
 * The task types a buyer can be allowed to create.
 *
 * Its own module, with no `server-only` and no Prisma import, so the admin
 * settings form and the server-side `buyer-settings.ts` share ONE list. A
 * hand-copied second list in the client is how the tick-boxes end up offering a
 * type the server then rejects.
 */
export const BUYER_TASK_TYPES = ["SOCIAL", "VIDEO", "CUSTOM", "SURVEY"] as const;

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
};

export type BuyerTaskType = (typeof BUYER_TASK_TYPES)[number];
