/**
 * @mention parsing utilities.
 * - extract @username tokens from raw post/comment content
 * - resolve them to userIds via Prisma
 * - render content with clickable @username links to /u/<id>
 */
import { prisma } from "@/lib/prisma";

const MENTION_RE = /@([a-zA-Z0-9_]{2,30})/g;

export function extractMentionUsernames(content: string): string[] {
  if (!content) return [];
  const matches = content.matchAll(MENTION_RE);
  const set = new Set<string>();
  for (const m of matches) {
    set.add(m[1].toLowerCase());
  }
  return Array.from(set);
}

export async function resolveMentionedUsers(
  usernames: string[]
): Promise<Array<{ id: string; username: string }>> {
  if (usernames.length === 0) return [];
  // Case-insensitive lookup — usernames stored mixed-case
  const users = await prisma.user.findMany({
    where: {
      username: { in: usernames, mode: "insensitive" },
    },
    select: { id: true, username: true },
  });
  return users
    .filter((u) => typeof u.username === "string" && u.username.length > 0)
    .map((u) => ({ id: u.id, username: u.username as string }));
}

/**
 * Render-safe HTML-ish output is not done here (React handles it client-side).
 * Returns segments so the client can map them to <Link> or <span>.
 */
export interface MentionSegment {
  type: "text" | "mention";
  value: string;
  userId?: string;
}

export function splitContentByMentions(
  content: string,
  userMap: Map<string, string> // username (lowercased) -> userId
): MentionSegment[] {
  if (!content) return [];
  const out: MentionSegment[] = [];
  let lastIndex = 0;
  for (const m of content.matchAll(MENTION_RE)) {
    const start = m.index ?? 0;
    const username = m[1];
    if (start > lastIndex) {
      out.push({ type: "text", value: content.slice(lastIndex, start) });
    }
    const userId = userMap.get(username.toLowerCase());
    if (userId) {
      out.push({ type: "mention", value: `@${username}`, userId });
    } else {
      // Unknown user — render plain text
      out.push({ type: "text", value: `@${username}` });
    }
    lastIndex = start + m[0].length;
  }
  if (lastIndex < content.length) {
    out.push({ type: "text", value: content.slice(lastIndex) });
  }
  return out;
}
