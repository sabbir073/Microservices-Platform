/**
 * The look of task credit, in one place.
 *
 * The platform already colour-codes its balances: earned points are amber,
 * cash is emerald, ad credit is sky. Task credit is **violet**, and it matters
 * that it is never any other colour — the whole reason the balance is separate
 * is that a buyer must be able to tell at a glance which pot they are looking
 * at. Two screens tinting it differently would undo that faster than any
 * wording.
 *
 * Client-safe: no server imports, so the wallet card, the buy page and the
 * buyer hub all read the same tokens.
 */
export const TASK_CREDIT = {
  /** What to call it in front of users. Not "points" on its own — ambiguous. */
  label: "Task Credit",
  /** One line saying what it is for and what it is not. */
  blurb: "Funds your tasks · not withdrawable",
  text: "text-violet-400",
  textStrong: "text-violet-300",
  bg: "bg-violet-500/10",
  bgStrong: "bg-violet-500/15",
  border: "border-violet-500/30",
  ring: "ring-violet-500/20",
  /** Solid fill for a primary action. */
  solid: "bg-violet-500 hover:bg-violet-600",
  /** Chip: background + text + border together. */
  chip: "bg-violet-500/10 text-violet-300 border-violet-500/30",
} as const;
