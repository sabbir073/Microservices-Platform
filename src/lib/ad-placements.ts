/**
 * Canonical ad placements (slots) across the platform. Each maps to a
 * `<AdRenderer placement="NAME">` mounted somewhere in the UI. The `name` is the
 * unique key stored in the AdPlacement table and passed to /api/ads/serve.
 *
 * NOTE: this file must stay client-safe (no prisma import) — it is imported by
 * the client AdManagerView. Server-only helpers live in ./ad-placements-server.
 */
export const AD_PLACEMENTS = [
  { name: "TASK_LIST", label: "Task List", description: "Top of the tasks hub and task list pages." },
  { name: "TASK_START", label: "Task Start", description: "Article / video / survey task detail pages." },
  { name: "VIDEO_ABOVE", label: "Video — Above", description: "Above the video player while watching." },
  { name: "VIDEO_BELOW", label: "Video — Below", description: "Below the video player while watching." },
  { name: "TASK_COMPLETE", label: "Task Complete", description: "Task completion / reward screens." },
  { name: "IN_FEED", label: "Social Feed", description: "Native ad interleaved in the social feed." },
  { name: "DASHBOARD", label: "Dashboard", description: "User dashboard banner." },
  { name: "EARN_HUB", label: "Earn Hub", description: "Earn hub banner." },
  { name: "WALLET_TOP", label: "Wallet", description: "Top of the wallet page." },
  { name: "MARKETPLACE_TOP", label: "Marketplace", description: "Top of the marketplace." },
  { name: "PROFILE_BOTTOM", label: "Profile", description: "Bottom of user profiles." },
  { name: "GAME_INTERSTITIAL", label: "Game Interstitial", description: "Full-screen ad on game open / resume / quit." },
] as const;

export type AdPlacementName = (typeof AD_PLACEMENTS)[number]["name"];
