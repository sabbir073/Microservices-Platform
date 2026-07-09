// Facebook-style colored backgrounds for text-only posts.
//
// Only the `id` is stored on Post.backgroundStyle; the composer preview and the
// feed card resolve it to Tailwind classes via getPostBackground(). Keep this the
// single source of truth so stored posts always render consistently.

export interface PostBackground {
  id: string;
  label: string;
  /** Tailwind background classes (gradient or solid). */
  className: string;
  /** Text color class that reads well on the background. */
  textClass: string;
}

export const POST_BACKGROUNDS: PostBackground[] = [
  { id: "ocean", label: "Ocean", className: "bg-linear-to-br from-cyan-500 to-blue-600", textClass: "text-white" },
  { id: "sunset", label: "Sunset", className: "bg-linear-to-br from-orange-500 via-pink-500 to-rose-600", textClass: "text-white" },
  { id: "grape", label: "Grape", className: "bg-linear-to-br from-indigo-500 to-purple-600", textClass: "text-white" },
  { id: "forest", label: "Forest", className: "bg-linear-to-br from-emerald-500 to-teal-600", textClass: "text-white" },
  { id: "fire", label: "Fire", className: "bg-linear-to-br from-amber-500 to-red-600", textClass: "text-white" },
  { id: "candy", label: "Candy", className: "bg-linear-to-br from-pink-500 to-fuchsia-600", textClass: "text-white" },
  { id: "night", label: "Night", className: "bg-linear-to-br from-slate-800 to-gray-900", textClass: "text-white" },
  { id: "gold", label: "Gold", className: "bg-linear-to-br from-yellow-400 to-amber-600", textClass: "text-gray-900" },
  { id: "mint", label: "Mint", className: "bg-linear-to-br from-green-400 to-emerald-500", textClass: "text-gray-900" },
];

const BY_ID = new Map(POST_BACKGROUNDS.map((b) => [b.id, b]));

/** Resolve a stored background id to its palette entry (null when unset/unknown). */
export function getPostBackground(id?: string | null): PostBackground | null {
  if (!id) return null;
  return BY_ID.get(id) ?? null;
}

/** True when the id is a known background. */
export function isValidPostBackground(id: string): boolean {
  return BY_ID.has(id);
}
