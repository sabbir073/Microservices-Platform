// Client-safe feature catalog + types. NO server imports (prisma) here, so this
// can be used from client components (admin per-user override UI). Server-only
// resolution helpers live in `src/lib/packages.ts`.

/**
 * Single feature flag a Plan can toggle on/off. Maps 1:1 to a `*Enabled`
 * boolean column on the Package table.
 */
export type PackageFeatureKey =
  // Section-level
  | "tasks"
  | "socialFeed"
  | "referrals"
  | "withdrawals"
  | "marketplace"
  | "boost"
  | "dailyMission"
  | "lottery"
  | "courses"
  | "advertiser"
  | "games"
  // Per-task-type
  | "socialTasks"
  | "proxyTasks"
  | "articleTasks"
  | "videoTasks"
  | "quizTasks"
  | "surveyTasks"
  | "offerwallTasks"
  | "appInstall";

export const FEATURE_TO_COLUMN: Record<PackageFeatureKey, string> = {
  tasks: "tasksEnabled",
  socialFeed: "socialFeedEnabled",
  referrals: "referralsEnabled",
  withdrawals: "withdrawalsEnabled",
  marketplace: "marketplaceEnabled",
  boost: "boostEnabled",
  dailyMission: "dailyMissionEnabled",
  lottery: "lotteryEnabled",
  courses: "coursesEnabled",
  advertiser: "advertiserEnabled",
  games: "gamesEnabled",
  socialTasks: "socialTasksEnabled",
  proxyTasks: "proxyTasksEnabled",
  articleTasks: "articleTasksEnabled",
  videoTasks: "videoTasksEnabled",
  quizTasks: "quizTasksEnabled",
  surveyTasks: "surveyTasksEnabled",
  offerwallTasks: "offerwallTasksEnabled",
  appInstall: "appInstallEnabled",
};

/** All feature keys (stable order) — for iterating overrides + admin UIs. */
export const FEATURE_KEYS = Object.keys(
  FEATURE_TO_COLUMN
) as PackageFeatureKey[];

/** Catalog for admin UIs (package form + per-user overrides). */
export const FEATURES: {
  key: PackageFeatureKey;
  label: string;
  group: "section" | "task";
}[] = [
  { key: "tasks", label: "Tasks", group: "section" },
  { key: "socialFeed", label: "Social Feed", group: "section" },
  { key: "referrals", label: "Referrals", group: "section" },
  { key: "withdrawals", label: "Withdrawals", group: "section" },
  { key: "marketplace", label: "Marketplace", group: "section" },
  { key: "boost", label: "Post Boost", group: "section" },
  { key: "dailyMission", label: "Daily Mission", group: "section" },
  { key: "lottery", label: "Lottery", group: "section" },
  { key: "courses", label: "Courses", group: "section" },
  { key: "advertiser", label: "Advertiser (create ads)", group: "section" },
  { key: "games", label: "HTML5 Games", group: "section" },
  { key: "socialTasks", label: "Social Tasks", group: "task" },
  { key: "proxyTasks", label: "Proxy Tasks", group: "task" },
  { key: "articleTasks", label: "Article Tasks", group: "task" },
  { key: "videoTasks", label: "Video Tasks", group: "task" },
  { key: "quizTasks", label: "Quiz Tasks", group: "task" },
  { key: "surveyTasks", label: "Survey Tasks", group: "task" },
  { key: "offerwallTasks", label: "Offerwall Tasks", group: "task" },
  { key: "appInstall", label: "App Install Tasks", group: "task" },
];

/** Sparse per-user grants/denials that override the package value. */
export type FeatureOverrides = Partial<Record<PackageFeatureKey, boolean>>;

/** Safely read a stored `featureOverrides` JSON into a typed sparse map. */
export function parseFeatureOverrides(v: unknown): FeatureOverrides {
  if (!v || typeof v !== "object") return {};
  const src = v as Record<string, unknown>;
  const out: FeatureOverrides = {};
  for (const k of FEATURE_KEYS) {
    if (typeof src[k] === "boolean") out[k] = src[k] as boolean;
  }
  return out;
}
