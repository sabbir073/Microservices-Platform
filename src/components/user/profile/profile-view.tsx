"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Shield,
  Trophy,
  Camera,
  X,
  Loader2,
  Globe,
  CheckCircle,
  CheckCircle2,
  Circle,
  Edit3,
  Sparkles,
  Users,
  Crown,
  Tag,
  Plus,
  Trash2,
  ChevronRight,
  Twitter,
  Facebook,
  Instagram,
  Youtube,
  Linkedin,
  Send,
  MessageCircle,
  Music2,
  Eye,
  EyeOff,
  Lock,
  Palette,
  CreditCard,
  Bell,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CompletionItem {
  key: string;
  label: string;
  category: "basic" | "contact" | "address" | "verification" | "social";
  done: boolean;
  weight: number;
  href?: string;
}

interface SocialAccount {
  id: string;
  platform:
    | "TWITTER"
    | "FACEBOOK"
    | "INSTAGRAM"
    | "YOUTUBE"
    | "TIKTOK"
    | "LINKEDIN"
    | "TELEGRAM"
    | "DISCORD";
  username: string;
  url: string | null;
  followers: number;
  following: number;
  postsCount: number;
  verified: boolean;
  connectedAt: string;
}

interface ProfileResponse {
  profile: {
    id: string;
    name: string | null;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    email: string;
    avatar: string | null;
    coverPhoto: string | null;
    bio: string | null;
    phone: string | null;
    secondaryEmail: string | null;
    secondaryPhone: string | null;
    gender: string | null;
    dateOfBirth: string | null;
    nidNumber: string | null;
    profession: string | null;
    nationality: string | null;
    bloodGroup: string | null;
    country: string | null;
    language: string;
    timezone: string;
    tags: string[];
    createdAt: string;
  };
  address: {
    street: string | null;
    village: string | null;
    city: string | null;
    subDistrict: string | null;
    district: string | null;
    subDivision: string | null;
    division: string | null;
    region: string | null;
    postalCode: string | null;
    country: string | null;
  };
  stats: {
    level: number;
    xp: number;
    xpProgress: number;
    xpNeeded: number;
    xpPercentage: number;
    pointsBalance: number;
    cashBalance: number;
    totalEarnings: number;
    tasksCompleted: number;
    referralsCount: number;
    achievementsCount: number;
    socialAccountsCount: number;
    postsCount: number;
    followersCount: number;
    followingCount: number;
  };
  package: {
    tier: string;
    name: string;
  };
  referral: {
    code: string;
    link: string;
  };
  verification: {
    kycStatus: string;
    isBlueVerified: boolean;
    isEmailVerified: boolean;
    isPhoneVerified: boolean;
    twoFactorEnabled: boolean;
    isFullyVerified: boolean;
  };
  preferences: {
    theme: string;
    themeAccent: string;
    notifications: { enabled: boolean; email: boolean; push: boolean };
    privacy: { avatar: string; bio: string; stats: string; earnings: string; location: string };
  };
  socialAccounts: SocialAccount[];
  completion: {
    percentage: number;
    items: CompletionItem[];
    missing: CompletionItem[];
  };
}

const COUNTRIES = [
  { code: "BD", name: "Bangladesh" },
  { code: "IN", name: "India" },
  { code: "PK", name: "Pakistan" },
  { code: "US", name: "United States" },
  { code: "UK", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "AE", name: "UAE" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "MY", name: "Malaysia" },
  { code: "SG", name: "Singapore" },
  { code: "ID", name: "Indonesia" },
  { code: "PH", name: "Philippines" },
  { code: "NG", name: "Nigeria" },
  { code: "EG", name: "Egypt" },
];

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "bn", name: "Bengali" },
  { code: "hi", name: "Hindi" },
  { code: "ar", name: "Arabic" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "zh", name: "Chinese" },
];

const TAG_OPTIONS: { id: string; label: string; emoji: string }[] = [
  { id: "EARLY_ADOPTER", label: "Early Adopter", emoji: "🚀" },
  { id: "VERIFIED", label: "Verified", emoji: "✓" },
  { id: "CRYPTO", label: "Crypto", emoji: "₿" },
  { id: "TRADER", label: "Trader", emoji: "📈" },
  { id: "GAMER", label: "Gamer", emoji: "🎮" },
  { id: "INFLUENCER", label: "Influencer", emoji: "📣" },
  { id: "WHALE", label: "Whale", emoji: "🐋" },
  { id: "PRO", label: "Pro", emoji: "🏆" },
  { id: "ELITE", label: "Elite", emoji: "💎" },
  { id: "CREATOR", label: "Creator", emoji: "🎨" },
];

const PLATFORM_META: Record<
  SocialAccount["platform"],
  { label: string; icon: typeof Twitter; gradient: string; countLabel: string }
> = {
  TWITTER: { label: "Twitter / X", icon: Twitter, gradient: "from-sky-500 to-blue-600", countLabel: "Followers" },
  FACEBOOK: { label: "Facebook", icon: Facebook, gradient: "from-blue-500 to-indigo-600", countLabel: "Followers" },
  INSTAGRAM: { label: "Instagram", icon: Instagram, gradient: "from-pink-500 to-purple-600", countLabel: "Followers" },
  YOUTUBE: { label: "YouTube", icon: Youtube, gradient: "from-red-500 to-rose-600", countLabel: "Subscribers" },
  TIKTOK: { label: "TikTok", icon: Music2, gradient: "from-fuchsia-500 to-rose-500", countLabel: "Followers" },
  LINKEDIN: { label: "LinkedIn", icon: Linkedin, gradient: "from-cyan-600 to-blue-700", countLabel: "Connections" },
  TELEGRAM: { label: "Telegram", icon: Send, gradient: "from-sky-400 to-blue-500", countLabel: "Subscribers" },
  DISCORD: { label: "Discord", icon: MessageCircle, gradient: "from-indigo-500 to-violet-600", countLabel: "Server members" },
};

type Tab = "overview" | "personal" | "address" | "kyc" | "social" | "privacy" | "theme" | "security";

export function ProfileView() {
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [photoTarget, setPhotoTarget] = useState<"avatar" | "coverPhoto" | null>(null);
  const [connectPlatform, setConnectPlatform] = useState<SocialAccount["platform"] | null>(null);
  const [autoCountry, setAutoCountry] = useState<{
    country: string | null;
    timezone: string | null;
    dismissed: boolean;
  } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/profile");
      if (!res.ok) throw new Error(await res.text());
      setData((await res.json()) as ProfileResponse);
    } catch (err) {
      toast.error("Couldn't load profile", {
        description: err instanceof Error ? err.message : "Try again",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Auto-country detection — only fires when country is missing
  useEffect(() => {
    if (!data || data.profile.country || autoCountry) return;
    fetch("/api/profile/auto-detect")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.country || d?.timezone) {
          setAutoCountry({ country: d.country, timezone: d.timezone, dismissed: false });
        }
      })
      .catch(() => {});
  }, [data, autoCountry]);

  const acceptAutoCountry = async () => {
    if (!autoCountry?.country) return;
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country: autoCountry.country,
          ...(autoCountry.timezone ? { timezone: autoCountry.timezone } : {}),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success(`Country set to ${autoCountry.country}`);
      setAutoCountry({ ...autoCountry, dismissed: true });
      load();
    } catch (err) {
      toast.error("Couldn't apply", {
        description: err instanceof Error ? err.message : "Try again",
      });
    }
  };

  const patch = async (body: Record<string, unknown>): Promise<boolean> => {
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? `HTTP ${res.status}`);
      toast.success("Saved");
      load();
      return true;
    } catch (err) {
      toast.error("Save failed", {
        description: err instanceof Error ? err.message : "Try again",
      });
      return false;
    }
  };

  const disconnectSocial = async (id: string) => {
    if (!confirm("Disconnect this account?")) return;
    try {
      const res = await fetch(`/api/profile/social-accounts/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Disconnected");
      load();
    } catch (err) {
      toast.error("Couldn't disconnect", {
        description: err instanceof Error ? err.message : "Try again",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-gray-400">
        Couldn&apos;t load your profile. Try refreshing.
      </div>
    );
  }

  const { profile, stats, verification, preferences, socialAccounts, completion } = data;
  const displayName = profile.name ?? `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim() ?? "User";
  const initial = (displayName || profile.email).charAt(0).toUpperCase();

  return (
    <div className="space-y-6 pb-12">
      {/* Auto-country banner */}
      {autoCountry?.country && !autoCountry.dismissed && !profile.country && (
        <div className="rounded-xl border border-indigo-500/40 bg-indigo-500/10 p-3 flex items-center gap-3">
          <Globe className="w-4 h-4 text-indigo-400 shrink-0" />
          <p className="text-sm text-indigo-200 flex-1">
            We detected you&apos;re in{" "}
            <strong>{COUNTRIES.find((c) => c.code === autoCountry.country)?.name ?? autoCountry.country}</strong>.
            Auto-fill your profile?
          </p>
          <button
            onClick={acceptAutoCountry}
            className="px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold"
          >
            Yes, use it
          </button>
          <button
            onClick={() => setAutoCountry({ ...autoCountry, dismissed: true })}
            className="p-1.5 text-indigo-300 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Profile Header */}
      <div className="relative rounded-2xl overflow-hidden border border-gray-800">
        <div className="relative h-36 sm:h-48 bg-linear-to-br from-indigo-600 via-purple-600 to-pink-600">
          {profile.coverPhoto && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.coverPhoto} alt="" className="w-full h-full object-cover" />
          )}
          <button
            onClick={() => setPhotoTarget("coverPhoto")}
            className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/50 backdrop-blur-md text-white text-xs hover:bg-black/70"
          >
            <Camera className="w-3.5 h-3.5" />
            Edit Cover
          </button>
        </div>
        <div className="bg-gray-900 px-4 sm:px-6 pt-12 pb-5 relative">
          <div className="absolute -top-12 left-4 sm:left-6">
            <div className="relative">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-linear-to-br from-indigo-500 to-purple-600 border-4 border-gray-900 flex items-center justify-center text-white text-3xl font-extrabold overflow-hidden">
                {profile.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  initial
                )}
              </div>
              <button
                onClick={() => setPhotoTarget("avatar")}
                className="absolute bottom-1 right-1 p-1.5 bg-gray-800 hover:bg-gray-700 rounded-full border border-gray-700"
              >
                <Camera className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
          </div>

          <div className="flex justify-end mb-2">
            <button
              onClick={() => setTab("personal")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-xs font-semibold"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit Profile
            </button>
          </div>

          <div className="flex items-start gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-white">{displayName}</h1>
            {verification.isBlueVerified && (
              <span title="KYC verified" className="text-blue-400 mt-1">
                <CheckCircle className="w-5 h-5 fill-blue-500 text-white" />
              </span>
            )}
            <span className="ml-auto inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-[10px] font-bold uppercase tracking-wider">
              <Crown className="w-3 h-3" />
              {data.package.tier}
            </span>
          </div>
          <p className="text-gray-500 text-sm">@{profile.username ?? profile.email.split("@")[0]}</p>
          {profile.bio && <p className="text-sm text-gray-300 mt-2">{profile.bio}</p>}

          <div className="flex items-center flex-wrap gap-3 mt-3 text-xs text-gray-400">
            {profile.country && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {COUNTRIES.find((c) => c.code === profile.country)?.name ?? profile.country}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Joined{" "}
              {new Date(profile.createdAt).toLocaleDateString("en-US", {
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap items-center gap-1.5 mt-3">
            {profile.tags.map((t) => {
              const meta = TAG_OPTIONS.find((o) => o.id === t);
              return (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 text-[11px] font-medium border border-indigo-500/30"
                >
                  <span>{meta?.emoji ?? "★"}</span>
                  {meta?.label ?? t}
                </span>
              );
            })}
            <button
              onClick={() => setTagModalOpen(true)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-300 text-[11px] font-medium border border-gray-700"
            >
              <Tag className="w-3 h-3" />
              {profile.tags.length === 0 ? "Add tags" : "Edit tags"}
            </button>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile icon={<Edit3 className="w-4 h-4" />} label="Posts" value={stats.postsCount.toLocaleString()} tone="indigo" />
        <StatTile icon={<Users className="w-4 h-4" />} label="Followers" value={stats.followersCount.toLocaleString()} tone="purple" />
        <StatTile icon={<Plus className="w-4 h-4" />} label="Following" value={stats.followingCount.toLocaleString()} tone="emerald" />
        <StatTile icon={<Trophy className="w-4 h-4" />} label="Level" value={`Lv ${stats.level}`} tone="amber" />
      </div>

      {/* Profile completion ring */}
      <CompletionCard
        percentage={completion.percentage}
        missing={completion.missing}
        onJump={(href) => {
          if (!href) return;
          const params = new URLSearchParams(href.replace(/^\?/, ""));
          const t = params.get("tab") as Tab | null;
          if (t) setTab(t);
        }}
      />

      {/* Tab nav */}
      <nav className="flex gap-1 overflow-x-auto -mx-2 px-2 pb-1 border-b border-gray-800">
        {(
          [
            { key: "overview", label: "Overview", icon: User },
            { key: "personal", label: "Personal", icon: User },
            { key: "address", label: "Address", icon: MapPin },
            { key: "kyc", label: "KYC", icon: Shield },
            { key: "social", label: "Social", icon: Twitter },
            { key: "privacy", label: "Privacy", icon: Lock },
            { key: "theme", label: "Theme", icon: Palette },
            { key: "security", label: "Security", icon: Shield },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
              tab === t.key
                ? "bg-indigo-500/15 text-white border border-indigo-500/40"
                : "text-gray-400 hover:text-white hover:bg-gray-900"
            )}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      {tab === "overview" && <OverviewTab data={data} />}
      {tab === "personal" && <PersonalTab data={data} patch={patch} />}
      {tab === "address" && <AddressTab data={data} patch={patch} />}
      {tab === "kyc" && <KycTab data={data} />}
      {tab === "social" && (
        <SocialTab
          accounts={socialAccounts}
          onConnect={(p) => setConnectPlatform(p)}
          onDisconnect={disconnectSocial}
        />
      )}
      {tab === "privacy" && <PrivacyTab privacy={preferences.privacy} patch={patch} />}
      {tab === "theme" && <ThemeTab preferences={preferences} patch={patch} />}
      {tab === "security" && <SecurityTab verification={verification} />}

      {/* Modals */}
      {tagModalOpen && (
        <TagModal
          selected={profile.tags}
          onClose={() => setTagModalOpen(false)}
          onSave={async (tags) => {
            const ok = await patch({ tags });
            if (ok) setTagModalOpen(false);
          }}
        />
      )}

      {photoTarget && (
        <PhotoModal
          target={photoTarget}
          currentUrl={photoTarget === "avatar" ? profile.avatar : profile.coverPhoto}
          onClose={() => setPhotoTarget(null)}
          onSave={async (url) => {
            const ok = await patch({ [photoTarget]: url });
            if (ok) setPhotoTarget(null);
          }}
        />
      )}

      {connectPlatform && (
        <ConnectSocialModal
          platform={connectPlatform}
          existing={socialAccounts.find((a) => a.platform === connectPlatform)}
          onClose={() => setConnectPlatform(null)}
          onSaved={() => {
            setConnectPlatform(null);
            load();
          }}
        />
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Sub-components
// ───────────────────────────────────────────────────────────────────────────

function StatTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "indigo" | "amber" | "emerald" | "purple";
}) {
  const tones = {
    indigo: "text-indigo-400 bg-indigo-500/10",
    amber: "text-amber-400 bg-amber-500/10",
    emerald: "text-emerald-400 bg-emerald-500/10",
    purple: "text-purple-400 bg-purple-500/10",
  } as const;
  return (
    <div className="rounded-xl bg-gray-900 border border-gray-800 p-3 flex items-center gap-3">
      <div className={cn("p-2 rounded-lg", tones[tone])}>{icon}</div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-base font-bold text-white tabular-nums">{value}</p>
      </div>
    </div>
  );
}

function CompletionCard({
  percentage,
  missing,
  onJump,
}: {
  percentage: number;
  missing: CompletionItem[];
  onJump: (href?: string) => void;
}) {
  const ringColor =
    percentage >= 90
      ? "stroke-emerald-400"
      : percentage >= 60
      ? "stroke-amber-400"
      : "stroke-indigo-400";

  return (
    <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
      <div className="flex items-center gap-4">
        {/* Ring */}
        <div className="relative w-20 h-20 shrink-0">
          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="42"
              className="fill-none stroke-gray-800"
              strokeWidth="10"
            />
            <circle
              cx="50"
              cy="50"
              r="42"
              className={cn("fill-none transition-[stroke-dashoffset]", ringColor)}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={Math.PI * 84}
              strokeDashoffset={Math.PI * 84 * (1 - percentage / 100)}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-base font-extrabold text-white tabular-nums">
              {percentage}%
            </span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-white">Profile Completion</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {percentage === 100
              ? "Looking sharp — all set!"
              : missing.length === 1
              ? "1 item left to make it perfect"
              : `${missing.length} items left to make it perfect`}
          </p>
          {missing.length > 0 && (
            <p className="text-[11px] text-indigo-400 mt-1">
              Higher completion = better task acceptance + premium opportunities.
            </p>
          )}
        </div>
      </div>

      {missing.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-3 max-h-40 overflow-y-auto">
          {missing.slice(0, 12).map((it) => (
            <button
              key={it.key}
              onClick={() => onJump(it.href)}
              className="flex items-center gap-2 p-2 rounded-lg bg-gray-950 border border-gray-800 hover:border-indigo-500/40 text-left transition-colors"
            >
              <Circle className="w-3.5 h-3.5 text-gray-600 shrink-0" />
              <span className="text-xs text-gray-300 flex-1 truncate">{it.label}</span>
              <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function OverviewTab({ data }: { data: ProfileResponse }) {
  const { stats, verification, completion, socialAccounts } = data;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card title="Verification">
        <Row icon={<Mail className="w-4 h-4" />} label="Email" right={
          verification.isEmailVerified ? <Verified /> : <span className="text-amber-400 text-xs">Not verified</span>
        } />
        <Row icon={<Phone className="w-4 h-4" />} label="Phone" right={
          verification.isPhoneVerified ? <Verified /> : <span className="text-amber-400 text-xs">Not verified</span>
        } />
        <Row icon={<Shield className="w-4 h-4" />} label="KYC" right={
          verification.kycStatus === "APPROVED" ? <Verified /> :
          verification.kycStatus === "PENDING" ? <span className="text-yellow-400 text-xs">Pending</span> :
          verification.kycStatus === "REJECTED" ? (
            <Link href="/kyc/appeal" className="text-amber-400 text-xs hover:underline">Appeal →</Link>
          ) : <span className="text-gray-500 text-xs">Not submitted</span>
        } />
        <Row icon={<Lock className="w-4 h-4" />} label="2FA" right={
          verification.twoFactorEnabled ? <Verified /> : (
            <Link href="/2fa-setup" className="text-indigo-400 text-xs hover:underline">Enable</Link>
          )
        } />
      </Card>

      <Card title="At a glance">
        <Row icon={<Trophy className="w-4 h-4" />} label="Tasks completed" right={<strong className="text-white tabular-nums">{stats.tasksCompleted}</strong>} />
        <Row icon={<Sparkles className="w-4 h-4" />} label="Total earnings" right={<strong className="text-white tabular-nums">${stats.totalEarnings.toFixed(2)}</strong>} />
        <Row icon={<Twitter className="w-4 h-4" />} label="Connected socials" right={<strong className="text-white tabular-nums">{socialAccounts.length} / 8</strong>} />
        <Row icon={<CheckCircle2 className="w-4 h-4" />} label="Profile completion" right={<strong className="text-white tabular-nums">{completion.percentage}%</strong>} />
      </Card>
    </div>
  );
}

function PersonalTab({
  data,
  patch,
}: {
  data: ProfileResponse;
  patch: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const { profile } = data;
  const [form, setForm] = useState({
    firstName: profile.firstName ?? "",
    lastName: profile.lastName ?? "",
    username: profile.username ?? "",
    bio: profile.bio ?? "",
    gender: profile.gender ?? "",
    dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.slice(0, 10) : "",
    nidNumber: profile.nidNumber ?? "",
    profession: profile.profession ?? "",
    nationality: profile.nationality ?? "",
    bloodGroup: profile.bloodGroup ?? "",
    phone: profile.phone ?? "",
    secondaryEmail: profile.secondaryEmail ?? "",
    secondaryPhone: profile.secondaryPhone ?? "",
    language: profile.language,
    timezone: profile.timezone,
  });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    await patch({
      firstName: form.firstName || null,
      lastName: form.lastName || null,
      username: form.username || null,
      bio: form.bio || null,
      gender: form.gender || null,
      dateOfBirth: form.dateOfBirth || null,
      nidNumber: form.nidNumber || null,
      profession: form.profession || null,
      nationality: form.nationality || null,
      bloodGroup: form.bloodGroup || null,
      phone: form.phone || null,
      secondaryEmail: form.secondaryEmail || null,
      secondaryPhone: form.secondaryPhone || null,
      language: form.language,
      timezone: form.timezone,
    });
    setBusy(false);
  };

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  return (
    <Card title="Personal Info">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="First Name">
          <input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} className={inp} />
        </Field>
        <Field label="Last Name">
          <input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} className={inp} />
        </Field>
        <Field label="Username">
          <input value={form.username} onChange={(e) => set("username", e.target.value)} placeholder="e.g. @yourname" className={inp} />
        </Field>
        <Field label="Date of Birth">
          <input type="date" value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} className={inp} />
        </Field>
        <Field label="Gender">
          <select value={form.gender} onChange={(e) => set("gender", e.target.value)} className={inp}>
            <option value="">—</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </select>
        </Field>
        <Field label="National ID / Passport">
          <input value={form.nidNumber} onChange={(e) => set("nidNumber", e.target.value)} className={inp} />
        </Field>
        <Field label="Profession">
          <input value={form.profession} onChange={(e) => set("profession", e.target.value)} className={inp} />
        </Field>
        <Field label="Nationality">
          <input value={form.nationality} onChange={(e) => set("nationality", e.target.value)} className={inp} />
        </Field>
        <Field label="Blood Group">
          <select value={form.bloodGroup} onChange={(e) => set("bloodGroup", e.target.value)} className={inp}>
            <option value="">—</option>
            {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </Field>
        <Field label="Language">
          <select value={form.language} onChange={(e) => set("language", e.target.value)} className={inp}>
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Phone">
          <input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+880 1234 567890" className={inp} />
        </Field>
        <Field label="Secondary Phone">
          <input type="tel" value={form.secondaryPhone} onChange={(e) => set("secondaryPhone", e.target.value)} className={inp} />
        </Field>
        <Field label="Secondary Email">
          <input type="email" value={form.secondaryEmail} onChange={(e) => set("secondaryEmail", e.target.value)} className={inp} />
        </Field>
        <Field label="Timezone">
          <input value={form.timezone} onChange={(e) => set("timezone", e.target.value)} placeholder="Asia/Dhaka" className={inp} />
        </Field>
      </div>
      <Field label="Bio (about you)">
        <textarea
          rows={3}
          value={form.bio}
          onChange={(e) => set("bio", e.target.value)}
          maxLength={500}
          placeholder="A short intro that appears on your public profile."
          className={inp}
        />
      </Field>
      <div className="flex justify-end pt-2">
        <button
          onClick={save}
          disabled={busy}
          className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold rounded-lg disabled:opacity-50"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          Save Changes
        </button>
      </div>
    </Card>
  );
}

function AddressTab({
  data,
  patch,
}: {
  data: ProfileResponse;
  patch: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const { address } = data;
  const [form, setForm] = useState({
    street: address.street ?? "",
    village: address.village ?? "",
    city: address.city ?? "",
    subDistrict: address.subDistrict ?? "",
    district: address.district ?? "",
    division: address.division ?? "",
    region: address.region ?? "",
    postalCode: address.postalCode ?? "",
    country: address.country ?? "",
  });
  const [busy, setBusy] = useState(false);

  return (
    <Card title="Address">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Street">
          <input value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} className={inp} />
        </Field>
        <Field label="Village / Area">
          <input value={form.village} onChange={(e) => setForm({ ...form, village: e.target.value })} className={inp} />
        </Field>
        <Field label="City">
          <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className={inp} />
        </Field>
        <Field label="Sub-District / Thana">
          <input value={form.subDistrict} onChange={(e) => setForm({ ...form, subDistrict: e.target.value })} className={inp} />
        </Field>
        <Field label="District">
          <input value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} className={inp} />
        </Field>
        <Field label="Division / State">
          <input value={form.division} onChange={(e) => setForm({ ...form, division: e.target.value })} className={inp} />
        </Field>
        <Field label="Region">
          <input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} className={inp} />
        </Field>
        <Field label="Postal Code">
          <input value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} className={inp} />
        </Field>
        <Field label="Country">
          <select value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className={inp}>
            <option value="">—</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="flex justify-end pt-2">
        <button
          onClick={async () => {
            setBusy(true);
            await patch(form);
            setBusy(false);
          }}
          disabled={busy}
          className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold rounded-lg disabled:opacity-50"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          Save Address
        </button>
      </div>
    </Card>
  );
}

function KycTab({ data }: { data: ProfileResponse }) {
  const { verification } = data;
  return (
    <Card title="KYC Verification">
      <div className="rounded-lg p-3 border border-gray-800 bg-gray-950 mb-4">
        <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">Status</p>
        <p
          className={cn(
            "text-base font-bold mt-0.5",
            verification.kycStatus === "APPROVED" && "text-emerald-400",
            verification.kycStatus === "PENDING" && "text-amber-400",
            verification.kycStatus === "REJECTED" && "text-red-400",
            (!verification.kycStatus || verification.kycStatus === "NOT_SUBMITTED") && "text-gray-300"
          )}
        >
          {verification.kycStatus === "APPROVED"
            ? "✅ Approved — Blue verified"
            : verification.kycStatus === "PENDING"
            ? "⏱ Pending review"
            : verification.kycStatus === "REJECTED"
            ? "❌ Rejected"
            : "Not submitted"}
        </p>
      </div>

      <p className="text-sm text-gray-400 mb-4">
        Submit a government-issued ID (front + back) and a selfie to verify your identity.
        Approved KYC unlocks higher withdrawal limits and the blue 🔵 badge.
      </p>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/kyc"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold"
        >
          <Shield className="w-4 h-4" />
          {verification.kycStatus === "NOT_SUBMITTED" || !verification.kycStatus
            ? "Submit KYC"
            : "Manage KYC"}
        </Link>
        {verification.kycStatus === "REJECTED" && (
          <Link
            href="/kyc/appeal"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-sm font-bold border border-amber-500/30"
          >
            Appeal Rejection →
          </Link>
        )}
      </div>
    </Card>
  );
}

function SocialTab({
  accounts,
  onConnect,
  onDisconnect,
}: {
  accounts: SocialAccount[];
  onConnect: (p: SocialAccount["platform"]) => void;
  onDisconnect: (id: string) => void;
}) {
  const totalFollowers = useMemo(
    () => accounts.reduce((s, a) => s + a.followers, 0),
    [accounts]
  );
  const totalPosts = useMemo(
    () => accounts.reduce((s, a) => s + a.postsCount, 0),
    [accounts]
  );

  return (
    <div className="space-y-4">
      {accounts.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <StatTile icon={<Users className="w-4 h-4" />} label="Total followers" value={totalFollowers.toLocaleString()} tone="indigo" />
          <StatTile icon={<Twitter className="w-4 h-4" />} label="Connected" value={`${accounts.length} / 8`} tone="purple" />
          <StatTile icon={<Sparkles className="w-4 h-4" />} label="Total posts" value={totalPosts.toLocaleString()} tone="amber" />
        </div>
      )}

      <Card title="Connected Accounts">
        <p className="text-xs text-gray-400 mb-3">
          Connect your social profiles to show your reach. Follower counts are user-entered for now;
          admin can verify them to lock the badge.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(Object.keys(PLATFORM_META) as SocialAccount["platform"][]).map((platform) => {
            const meta = PLATFORM_META[platform];
            const account = accounts.find((a) => a.platform === platform);
            return (
              <div
                key={platform}
                className={cn(
                  "rounded-xl border p-3 transition-colors",
                  account
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-gray-800 bg-gray-900"
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0 bg-linear-to-br",
                      meta.gradient
                    )}
                  >
                    <meta.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white inline-flex items-center gap-1.5">
                      {meta.label}
                      {account?.verified && (
                        <CheckCircle className="w-3.5 h-3.5 text-blue-400 fill-blue-500/30" />
                      )}
                    </p>
                    {account ? (
                      <p className="text-[11px] text-gray-400">@{account.username}</p>
                    ) : (
                      <p className="text-[11px] text-gray-500">Not connected</p>
                    )}
                  </div>
                  {account ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onConnect(platform)}
                        className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-gray-800 rounded"
                        title="Edit"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDisconnect(account.id)}
                        className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded"
                        title="Disconnect"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => onConnect(platform)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold"
                    >
                      <Plus className="w-3 h-3" />
                      Connect
                    </button>
                  )}
                </div>
                {account && (
                  <div className="grid grid-cols-3 gap-1 mt-3 text-center text-[11px]">
                    <div className="rounded bg-gray-950 py-1.5">
                      <p className="text-white font-bold tabular-nums">
                        {account.followers.toLocaleString()}
                      </p>
                      <p className="text-gray-500">{meta.countLabel}</p>
                    </div>
                    <div className="rounded bg-gray-950 py-1.5">
                      <p className="text-white font-bold tabular-nums">
                        {account.following.toLocaleString()}
                      </p>
                      <p className="text-gray-500">Following</p>
                    </div>
                    <div className="rounded bg-gray-950 py-1.5">
                      <p className="text-white font-bold tabular-nums">
                        {account.postsCount.toLocaleString()}
                      </p>
                      <p className="text-gray-500">Posts</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function PrivacyTab({
  privacy,
  patch,
}: {
  privacy: { avatar: string; bio: string; stats: string; earnings: string; location: string };
  patch: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const fields: { key: keyof typeof privacy; label: string; hint: string }[] = [
    { key: "avatar", label: "Profile photo", hint: "Who can see your avatar" },
    { key: "bio", label: "Bio", hint: "Who can see your about-me" },
    { key: "stats", label: "Stats", hint: "Level, points balance, total earnings" },
    { key: "earnings", label: "Earnings", hint: "Lifetime earnings detail" },
    { key: "location", label: "Location", hint: "City / country shown on profile" },
  ];

  return (
    <Card title="Privacy Settings">
      <div className="space-y-2">
        {fields.map((f) => (
          <div
            key={f.key}
            className="flex items-center gap-3 p-3 rounded-lg bg-gray-950 border border-gray-800"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white">{f.label}</p>
              <p className="text-xs text-gray-500">{f.hint}</p>
            </div>
            <select
              value={privacy[f.key]}
              onChange={(e) => patch({ [`privacy${f.key.charAt(0).toUpperCase()}${f.key.slice(1)}`]: e.target.value })}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="PUBLIC">Public</option>
              <option value="FRIENDS">Friends</option>
              <option value="PRIVATE">Private</option>
            </select>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-800">
        <a
          href="/api/profile/export"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold"
        >
          ⬇️ Download My Data
        </a>
        <button
          onClick={() => toast.info("Account deletion request goes to support — open a ticket from /help.")}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-semibold border border-red-500/30"
        >
          🗑 Delete Account
        </button>
      </div>
    </Card>
  );
}

function ThemeTab({
  preferences,
  patch,
}: {
  preferences: { theme: string; themeAccent: string; notifications: { enabled: boolean; email: boolean; push: boolean } };
  patch: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  return (
    <div className="space-y-4">
      <Card title="Appearance">
        <p className="text-xs text-gray-400 uppercase tracking-wider font-bold mb-2">Mode</p>
        <div className="grid grid-cols-3 gap-2">
          {(["dark", "light", "system"] as const).map((t) => (
            <button
              key={t}
              onClick={() => patch({ theme: t })}
              className={cn(
                "py-3 rounded-lg text-sm font-semibold border capitalize",
                preferences.theme === t
                  ? "bg-indigo-500 text-white border-indigo-500"
                  : "bg-gray-900 text-gray-400 border-gray-800 hover:border-gray-700"
              )}
            >
              {t}
            </button>
          ))}
        </div>

        <p className="text-xs text-gray-400 uppercase tracking-wider font-bold mt-4 mb-2">Accent Color</p>
        <div className="flex flex-wrap gap-2">
          {[
            { id: "indigo", className: "bg-indigo-500" },
            { id: "purple", className: "bg-purple-500" },
            { id: "emerald", className: "bg-emerald-500" },
            { id: "amber", className: "bg-amber-500" },
            { id: "blue", className: "bg-blue-500" },
            { id: "rose", className: "bg-rose-500" },
          ].map((c) => (
            <button
              key={c.id}
              onClick={() => patch({ themeAccent: c.id })}
              className={cn(
                "w-9 h-9 rounded-full ring-2 ring-offset-2 ring-offset-gray-900 transition-all",
                c.className,
                preferences.themeAccent === c.id ? "ring-white" : "ring-transparent"
              )}
              title={c.id}
            />
          ))}
        </div>
      </Card>

      <Card title="Notifications">
        <Toggle
          label="All notifications"
          hint="Master switch — turning this off silences everything"
          checked={preferences.notifications.enabled}
          onChange={(v) => patch({ notificationsEnabled: v })}
        />
        <Toggle
          label="Email"
          hint="Important account updates by email"
          checked={preferences.notifications.email}
          onChange={(v) => patch({ emailNotifications: v })}
        />
        <Toggle
          label="Push"
          hint="In-app + browser push when available"
          checked={preferences.notifications.push}
          onChange={(v) => patch({ pushNotifications: v })}
        />
      </Card>
    </div>
  );
}

function SecurityTab({
  verification,
}: {
  verification: { twoFactorEnabled: boolean; isEmailVerified: boolean };
}) {
  return (
    <Card title="Security & Password">
      <div className="space-y-3">
        <Link
          href="/update-password"
          className="flex items-center gap-3 p-3 rounded-lg bg-gray-950 border border-gray-800 hover:border-indigo-500/40 transition-colors"
        >
          <Lock className="w-4 h-4 text-indigo-400" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white">Change Password</p>
            <p className="text-xs text-gray-500">Use a strong password unique to this account</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </Link>

        <Link
          href="/2fa-setup"
          className="flex items-center gap-3 p-3 rounded-lg bg-gray-950 border border-gray-800 hover:border-indigo-500/40 transition-colors"
        >
          <Shield className="w-4 h-4 text-emerald-400" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white">Two-Factor Authentication</p>
            <p className="text-xs text-gray-500">
              {verification.twoFactorEnabled ? "Enabled — manage backup codes" : "Add an extra layer with TOTP"}
            </p>
          </div>
          <span
            className={cn(
              "text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded",
              verification.twoFactorEnabled ? "bg-emerald-500/15 text-emerald-400" : "bg-gray-800 text-gray-400"
            )}
          >
            {verification.twoFactorEnabled ? "On" : "Off"}
          </span>
        </Link>

        <Link
          href="/payment-methods"
          className="flex items-center gap-3 p-3 rounded-lg bg-gray-950 border border-gray-800 hover:border-indigo-500/40 transition-colors"
        >
          <CreditCard className="w-4 h-4 text-amber-400" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white">Payment Methods</p>
            <p className="text-xs text-gray-500">Manage payout destinations</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </Link>

        <Link
          href="/notifications"
          className="flex items-center gap-3 p-3 rounded-lg bg-gray-950 border border-gray-800 hover:border-indigo-500/40 transition-colors"
        >
          <Bell className="w-4 h-4 text-purple-400" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white">Notifications inbox</p>
            <p className="text-xs text-gray-500">View account & system messages</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </Link>
      </div>
    </Card>
  );
}

// ───────────────────────────── Modals ─────────────────────────────

function TagModal({
  selected,
  onClose,
  onSave,
}: {
  selected: string[];
  onClose: () => void;
  onSave: (tags: string[]) => Promise<void>;
}) {
  const [picked, setPicked] = useState<string[]>(selected);
  const [busy, setBusy] = useState(false);
  const toggle = (id: string) => {
    setPicked((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= 3) {
        toast.error("Pick up to 3 tags");
        return prev;
      }
      return [...prev, id];
    });
  };
  return (
    <Modal onClose={busy ? undefined : onClose} title="Choose Profile Tags" subtitle="Pick up to 3">
      <div className="grid grid-cols-2 gap-2">
        {TAG_OPTIONS.map((t) => {
          const isOn = picked.includes(t.id);
          return (
            <button
              key={t.id}
              onClick={() => toggle(t.id)}
              className={cn(
                "flex items-center gap-2 p-3 rounded-lg border text-left",
                isOn
                  ? "border-indigo-500 bg-indigo-500/10"
                  : "border-gray-800 bg-gray-950 hover:border-gray-700"
              )}
            >
              <span className="text-lg">{t.emoji}</span>
              <span className="text-sm text-white flex-1">{t.label}</span>
              {isOn && <CheckCircle2 className="w-4 h-4 text-indigo-400" />}
            </button>
          );
        })}
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onClose} disabled={busy} className="px-4 py-2 text-sm text-gray-400 hover:text-white">
          Cancel
        </button>
        <button
          onClick={async () => {
            setBusy(true);
            await onSave(picked);
            setBusy(false);
          }}
          disabled={busy}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold rounded-lg disabled:opacity-50"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          Save
        </button>
      </div>
    </Modal>
  );
}

function PhotoModal({
  target,
  currentUrl,
  onClose,
  onSave,
}: {
  target: "avatar" | "coverPhoto";
  currentUrl: string | null;
  onClose: () => void;
  onSave: (url: string) => Promise<void>;
}) {
  const [url, setUrl] = useState(currentUrl ?? "");
  const [showHide, setShowHide] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      onClose={busy ? undefined : onClose}
      title={target === "avatar" ? "Update Profile Photo" : "Update Cover Photo"}
      subtitle="Paste a public image URL (uploaded media library URL works too)"
    >
      <div className="space-y-3">
        {url && (
          <div
            className={cn(
              "rounded-lg overflow-hidden border border-gray-800",
              target === "avatar" ? "w-32 h-32 mx-auto rounded-full" : "h-32"
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">Image URL</label>
          <div className="relative">
            <input
              type={showHide ? "text" : "url"}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className={cn(inp, "pr-9 font-mono text-xs")}
            />
            <button
              type="button"
              onClick={() => setShowHide((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-white"
            >
              {showHide ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        {url !== (currentUrl ?? "") && url !== "" && (
          <button
            onClick={() => setUrl("")}
            className="text-xs text-red-400 hover:text-red-300"
          >
            Clear (use default)
          </button>
        )}
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onClose} disabled={busy} className="px-4 py-2 text-sm text-gray-400 hover:text-white">
          Cancel
        </button>
        <button
          onClick={async () => {
            setBusy(true);
            await onSave(url);
            setBusy(false);
          }}
          disabled={busy}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold rounded-lg disabled:opacity-50"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          Save
        </button>
      </div>
    </Modal>
  );
}

function ConnectSocialModal({
  platform,
  existing,
  onClose,
  onSaved,
}: {
  platform: SocialAccount["platform"];
  existing: SocialAccount | undefined;
  onClose: () => void;
  onSaved: () => void;
}) {
  const meta = PLATFORM_META[platform];
  const [username, setUsername] = useState(existing?.username ?? "");
  const [followers, setFollowers] = useState(existing?.followers ?? 0);
  const [following, setFollowing] = useState(existing?.following ?? 0);
  const [postsCount, setPostsCount] = useState(existing?.postsCount ?? 0);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (username.trim().length < 2) {
      toast.error("Enter your username");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/profile/social-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          username: username.trim(),
          followers,
          following,
          postsCount,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error ?? `HTTP ${res.status}`);
      }
      toast.success(existing ? "Updated" : `Connected ${meta.label}`);
      onSaved();
    } catch (err) {
      toast.error("Couldn't save", {
        description: err instanceof Error ? err.message : "Try again",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      onClose={busy ? undefined : onClose}
      title={`${existing ? "Update" : "Connect"} ${meta.label}`}
      subtitle="Stats are shown on your profile. Admin can verify them later."
    >
      <div className="space-y-3">
        <Field label="Username">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="@yourname"
            className={inp}
          />
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label={meta.countLabel}>
            <input
              type="number"
              min={0}
              value={followers}
              onChange={(e) => setFollowers(parseInt(e.target.value) || 0)}
              className={inp}
            />
          </Field>
          <Field label="Following">
            <input
              type="number"
              min={0}
              value={following}
              onChange={(e) => setFollowing(parseInt(e.target.value) || 0)}
              className={inp}
            />
          </Field>
          <Field label="Posts">
            <input
              type="number"
              min={0}
              value={postsCount}
              onChange={(e) => setPostsCount(parseInt(e.target.value) || 0)}
              className={inp}
            />
          </Field>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onClose} disabled={busy} className="px-4 py-2 text-sm text-gray-400 hover:text-white">
          Cancel
        </button>
        <button
          onClick={save}
          disabled={busy}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold rounded-lg disabled:opacity-50"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          {existing ? "Save" : "Connect"}
        </button>
      </div>
    </Modal>
  );
}

// ───────────────────────────── tiny UI helpers ─────────────────────────────

const inp =
  "w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 sm:p-5 space-y-3">
      <h3 className="text-sm font-bold text-white">{title}</h3>
      {children}
    </div>
  );
}

function Row({
  icon,
  label,
  right,
}: {
  icon: React.ReactNode;
  label: string;
  right: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="text-gray-500">{icon}</span>
      <span className="flex-1 text-sm text-gray-300">{label}</span>
      <span className="shrink-0">{right}</span>
    </div>
  );
}

function Verified() {
  return (
    <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-semibold">
      <CheckCircle className="w-3.5 h-3.5" />
      Verified
    </span>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 p-3 rounded-lg bg-gray-950 border border-gray-800 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded bg-gray-800 border-gray-600 text-indigo-500"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white">{label}</p>
        {hint && <p className="text-xs text-gray-500">{hint}</p>}
      </div>
    </label>
  );
}

function Modal({
  onClose,
  title,
  subtitle,
  children,
}: {
  onClose?: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-gray-900 border border-gray-800 rounded-xl shadow-2xl max-w-lg w-full max-h-[92vh] flex flex-col">
        <div className="flex items-start justify-between px-5 py-3 border-b border-gray-800">
          <div>
            <h2 className="text-base font-semibold text-white">{title}</h2>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
