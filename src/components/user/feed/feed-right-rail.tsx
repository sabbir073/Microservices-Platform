"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Trophy,
  Crown,
  Hash,
  Flame,
  UserPlus,
  Check,
  Megaphone,
  BadgeCheck,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { profileHref } from "@/lib/user-href";

export interface RailEarner {
  id: string;
  name: string | null;
  username: string | null;
  avatar: string | null;
  level: number;
}

export interface RailFollowUser {
  id: string;
  name: string | null;
  username: string | null;
  avatar: string | null;
  level: number;
  isBlueVerified?: boolean;
  followersCount: number;
}

export interface RailPromo {
  title: string;
  subtitle: string | null;
  bgGradient: string | null;
  linkUrl: string | null;
}

interface Props {
  bestEarners: RailEarner[];
  whoToFollow: RailFollowUser[];
  trendingHashtags: { tag: string; count: number }[];
  promo?: RailPromo | null;
}

// Platform-themed demo topics (no topic model exists yet).
const DEMO_TOPICS = [
  "Earnings Tips",
  "Daily Missions",
  "Referral Team",
  "Task Strategies",
  "Crypto Payouts",
  "Success Stories",
];

function Card({
  title,
  icon,
  children,
  action,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-white inline-flex items-center gap-1.5">
          {icon}
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Avatar({
  name,
  avatar,
}: {
  name: string | null;
  avatar: string | null;
}) {
  if (avatar) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatar}
        alt=""
        className="w-9 h-9 rounded-full object-cover bg-gray-800 shrink-0"
      />
    );
  }
  return (
    <div className="w-9 h-9 rounded-full bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
      {(name ?? "?").charAt(0).toUpperCase()}
    </div>
  );
}

function FollowButton({ userId }: { userId: string }) {
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    setBusy(true);
    const next = !following;
    setFollowing(next); // optimistic
    try {
      const res = await fetch(`/api/users/${userId}/follow`, { method: "POST" });
      if (!res.ok) throw new Error();
    } catch {
      setFollowing(!next); // revert
      toast.error("Couldn't update follow");
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={cn(
        "inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold transition-colors shrink-0 disabled:opacity-50",
        following
          ? "bg-gray-800 text-gray-300"
          : "bg-white text-gray-900 hover:bg-gray-200"
      )}
    >
      {following ? (
        <>
          <Check className="w-3 h-3" /> Following
        </>
      ) : (
        <>
          <UserPlus className="w-3 h-3" /> Follow
        </>
      )}
    </button>
  );
}

export function FeedRightRail({
  bestEarners,
  whoToFollow,
  trendingHashtags,
  promo,
}: Props) {
  const rankTone = ["text-amber-400", "text-gray-300", "text-orange-400"];

  return (
    <div className="space-y-4">
      {/* Sponsored / Ad space (demo placeholder) */}
      <section className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <div className="h-28 bg-linear-to-br from-slate-800 to-gray-900 flex items-center justify-center">
          <Megaphone className="w-8 h-8 text-gray-600" />
        </div>
        <div className="p-3">
          <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">
            Sponsored
          </p>
          <p className="text-sm font-semibold text-white mt-0.5">
            Your ad could be here
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Promote your product to the community.
          </p>
        </div>
      </section>

      {/* Best Earners */}
      {bestEarners.length > 0 && (
        <Card
          title="Top Earners"
          icon={<Trophy className="w-4 h-4 text-amber-400" />}
          action={
            <Link href="/leaderboard" className="text-xs text-indigo-400 hover:text-indigo-300">
              See all
            </Link>
          }
        >
          <ul className="space-y-2.5">
            {bestEarners.map((u, i) => (
              <li key={u.id}>
                <Link href={profileHref(u)} className="flex items-center gap-2.5 group">
                  <span
                    className={cn(
                      "w-4 text-center text-xs font-bold tabular-nums",
                      rankTone[i] ?? "text-gray-600"
                    )}
                  >
                    {i < 3 ? <Crown className="w-3.5 h-3.5 inline" /> : i + 1}
                  </span>
                  <Avatar name={u.name} avatar={u.avatar} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate group-hover:text-indigo-300">
                      {u.name ?? "Anonymous"}
                    </p>
                    <p className="text-[11px] text-gray-500">Level {u.level}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Who to Follow */}
      {whoToFollow.length > 0 && (
        <Card title="Who to Follow" icon={<UserPlus className="w-4 h-4 text-indigo-400" />}>
          <ul className="space-y-3">
            {whoToFollow.map((u) => (
              <li key={u.id} className="flex items-center gap-2.5">
                <Link href={profileHref(u)}>
                  <Avatar name={u.name} avatar={u.avatar} />
                </Link>
                <div className="flex-1 min-w-0">
                  <Link
                    href={profileHref(u)}
                    className="text-sm font-semibold text-white truncate inline-flex items-center gap-1 hover:text-indigo-300"
                  >
                    <span className="truncate min-w-0">{u.name ?? "Anonymous"}</span>
                    {u.isBlueVerified && (
                      <BadgeCheck className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    )}
                  </Link>
                  <p className="text-[11px] text-gray-500 truncate">
                    {u.username ? `@${u.username}` : `Level ${u.level}`} ·{" "}
                    {u.followersCount} followers
                  </p>
                </div>
                <FollowButton userId={u.id} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Trending Hashtags */}
      {trendingHashtags.length > 0 && (
        <Card title="Trending Hashtags" icon={<Hash className="w-4 h-4 text-cyan-400" />}>
          <ul className="space-y-2">
            {trendingHashtags.map((h) => (
              <li key={h.tag} className="flex items-center justify-between">
                <span className="text-sm font-semibold text-indigo-300 truncate">
                  {h.tag}
                </span>
                {h.count > 0 && (
                  <span className="text-[11px] text-gray-500 tabular-nums shrink-0">
                    {h.count} posts
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Trending Topics (demo) */}
      <Card title="Trending Topics" icon={<Flame className="w-4 h-4 text-orange-400" />}>
        <div className="flex flex-wrap gap-1.5">
          {DEMO_TOPICS.map((t) => (
            <span
              key={t}
              className="px-2.5 py-1 rounded-full bg-gray-800 text-gray-300 text-xs font-medium inline-flex items-center gap-1"
            >
              <TrendingUp className="w-3 h-3 text-gray-500" />
              {t}
            </span>
          ))}
        </div>
      </Card>

      {/* Promotional content */}
      <Link
        href={promo?.linkUrl || "/packages"}
        className={cn(
          "block rounded-xl p-4 bg-linear-to-br text-white",
          promo?.bgGradient || "from-indigo-600 to-purple-600"
        )}
      >
        <p className="text-[10px] uppercase tracking-wider font-bold opacity-80">
          Promotion
        </p>
        <p className="text-base font-bold mt-0.5">
          {promo?.title ?? "Upgrade & earn more"}
        </p>
        <p className="text-xs opacity-90 mt-0.5">
          {promo?.subtitle ?? "Unlock higher rewards and referral levels."}
        </p>
        <span className="inline-block mt-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur text-[11px] font-semibold">
          Learn more →
        </span>
      </Link>

      {/* Footer links */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 px-1 text-[11px] text-gray-600">
        <Link href="/privacy" className="hover:text-gray-400">Privacy</Link>
        <Link href="/terms" className="hover:text-gray-400">Terms</Link>
        <Link href="/refund" className="hover:text-gray-400">Refunds</Link>
        <span>© {new Date().getFullYear()} EarnGPT</span>
      </div>
    </div>
  );
}
