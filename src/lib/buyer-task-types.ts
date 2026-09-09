/**
 * The task types a buyer can be allowed to create.
 *
 * Its own module, with no `server-only` and no Prisma import, so the admin
 * settings form and the server-side `buyer-settings.ts` share ONE list. A
 * hand-copied second list in the client is how the tick-boxes end up offering a
 * type the server then rejects.
 */
export const BUYER_TASK_TYPES = ["SOCIAL", "CUSTOM"] as const;

export type BuyerTaskType = (typeof BUYER_TASK_TYPES)[number];
