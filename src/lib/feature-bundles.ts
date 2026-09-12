import type { PackageFeatureKey } from "@/lib/features";

/**
 * What a capability needs alongside it to actually work.
 *
 * Granting a feature is not the same as making it usable. `createTasks` is the
 * clearest case: an admin ticks it On, the buyer opens the form, picks
 * "Social" — the only type most buyers want — and is told "Social task
 * creation isn't enabled for your account", because `POST /api/tasks/create`
 * gates SOCIAL separately on `socialTasks`. Nothing on the grant screen said
 * so. The admin then has to guess which of 28 switches was missing.
 *
 * Client-safe (no server imports) so the grant UI and the server can read the
 * same declaration.
 *
 * Three strengths, deliberately distinct:
 *  - `requires`  — without it the feature is partly or wholly broken.
 *  - `suggests`  — the feature works, but the user cannot reach or fund it.
 *  - `excludes`  — granting both is a contradiction worth flagging.
 */
export interface FeatureBundle {
  /** Why this capability needs a bundle at all — shown to the admin. */
  summary: string;
  requires?: { key: PackageFeatureKey; why: string }[];
  suggests?: { key: PackageFeatureKey; why: string }[];
  /** Non-feature access the admin has to check separately. */
  alsoNeeds?: { label: string; why: string }[];
  /** Access this capability does NOT imply — stated so it is not assumed. */
  doesNotGrant?: string[];
}

export const FEATURE_BUNDLES: Partial<
  Record<PackageFeatureKey, FeatureBundle>
> = {
  createTasks: {
    summary:
      "A buyer funds tasks from their wallet. On its own this switch only opens the create form — they still need a way to put money in, a way to reach the page, and permission for the task type they actually want to run.",
    requires: [
      {
        key: "socialTasks",
        why: "Creating a SOCIAL task is gated separately. Without this, a buyer who picks Social — the most common choice — is refused with an error that does not say which switch is missing.",
      },
    ],
    suggests: [
      {
        key: "videoTasks",
        why: "Needed for “watch my video” tasks. Without it that option is refused the same way Social is, with the same unhelpful message.",
      },
      {
        key: "targetTasks",
        why: "Lets the buyer choose a country, gender or age range. Without it their audience settings are silently discarded, not rejected.",
      },
    ],
    alsoNeeds: [
      {
        label: "/create-task must not be hidden for this user",
        why: "Page visibility (Admin → Visibility) can hide the route per user, which overrides the grant and leaves them with a working permission and no page.",
      },
      {
        label: "A funded wallet",
        why: "Task budgets are debited from cash. A buyer with a zero balance can fill the whole form in and only find out at the last step. /deposit is visible to everyone, so nothing needs granting — but they do need to have used it.",
      },
      {
        label: "KYC, if Buyer & Task Funding requires it",
        why: "When that setting is on, an unverified buyer is stopped before the money moves however many features they hold.",
      },
    ],
    doesNotGrant: [
      "Withdrawals — funding tasks and taking money out are separate permissions, and buying task budget is not a reason to open a payout channel.",
      "Any admin access. A buyer never sees other people's tasks, submissions or the review queue.",
      "Auto-approval. Buyer tasks still land in the admin review queue unless Buyer & Task Funding says otherwise.",
    ],
  },

  advertiser: {
    summary:
      "Running ads spends ad credit, which is bought with wallet funds.",
    alsoNeeds: [
      {
        label: "A funded wallet",
        why: "Ad credit is purchased from the cash balance; an advertiser with no funds can build a campaign that can never serve.",
      },
    ],
    doesNotGrant: ["Withdrawals.", "Any admin access."],
  },

  sellMarketplace: {
    summary: "Selling requires somewhere for the proceeds to go.",
    suggests: [
      {
        key: "marketplace",
        why: "Without the Marketplace section the seller cannot browse or manage their own listings from the UI.",
      },
    ],
    doesNotGrant: [
      "Withdrawals — a seller earns into their wallet; taking money out is a separate grant.",
    ],
  },

  sellCourses: {
    summary: "Tutors need the Courses section to manage what they publish.",
    suggests: [
      {
        key: "courses",
        why: "Without it the tutor cannot see the course pages their own students use.",
      },
    ],
    doesNotGrant: ["Withdrawals.", "Any admin access."],
  },

  agencyMode: {
    summary:
      "Agency mode is a user-side console, not an admin role. It does not confer any admin-panel permission.",
    doesNotGrant: [
      "Admin panel access — that is the RBAC role matrix (Admin → Roles), a different system entirely.",
    ],
  },
};

/**
 * Which required/suggested features are missing, given the grant the admin is
 * about to save.
 *
 * `effective` is what the user ends up with — package value with the pending
 * overrides applied — so a feature already supplied by their plan is not
 * reported missing, and one the admin has explicitly switched Off is.
 */
export function missingFor(
  key: PackageFeatureKey,
  effective: (k: PackageFeatureKey) => boolean
): { requires: { key: PackageFeatureKey; why: string }[]; suggests: { key: PackageFeatureKey; why: string }[] } {
  const bundle = FEATURE_BUNDLES[key];
  if (!bundle) return { requires: [], suggests: [] };
  return {
    requires: (bundle.requires ?? []).filter((d) => !effective(d.key)),
    suggests: (bundle.suggests ?? []).filter((d) => !effective(d.key)),
  };
}
