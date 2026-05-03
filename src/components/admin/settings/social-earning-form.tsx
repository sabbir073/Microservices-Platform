"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Save,
  Loader2,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  AtSign,
  Edit3,
  HandCoins,
  ListChecks,
  Power,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ActivityKey =
  | "post_create"
  | "view_received"
  | "like_received"
  | "vote_received"
  | "comment_received"
  | "share_received"
  | "donation_received"
  | "mention_received";

interface ActivityRow {
  enabled: boolean;
  points: number;
}

interface FormState {
  enabled: boolean;
  daily_cap_per_user: number;
  cap_per_post: number;
  min_account_age_hours: number;
  activities: Record<ActivityKey, ActivityRow>;
}

interface Props {
  initial: FormState;
  canEdit: boolean;
}

const ACTIVITY_META: Record<
  ActivityKey,
  { label: string; icon: typeof Sparkles; example: string; preview: (pts: number) => string }
> = {
  post_create: {
    label: "Post created",
    icon: Edit3,
    example: "When the user publishes a post (max 1×/day)",
    preview: (p) => `${p} pts per day if user posts`,
  },
  view_received: {
    label: "View received",
    icon: Eye,
    example: "When another user views the author's post (unique per viewer)",
    preview: (p) => `1,000 unique views = ${p * 1000} pts`,
  },
  like_received: {
    label: "Like received",
    icon: Heart,
    example: "Each like on the author's post",
    preview: (p) => `100 likes = ${p * 100} pts`,
  },
  vote_received: {
    label: "Vote received",
    icon: ListChecks,
    example: "Each vote on the author's poll (first time per voter)",
    preview: (p) => `100 votes = ${p * 100} pts`,
  },
  comment_received: {
    label: "Comment received",
    icon: MessageCircle,
    example: "Each comment on the author's post",
    preview: (p) => `50 comments = ${p * 50} pts`,
  },
  share_received: {
    label: "Share received",
    icon: Share2,
    example: "Each share of the author's post (when share-tracking ships)",
    preview: (p) => `20 shares = ${p * 20} pts`,
  },
  donation_received: {
    label: "Donation received",
    icon: HandCoins,
    example: "Bonus on top of donated points (donor pts already transfer)",
    preview: (p) => `10 donations = ${p * 10} bonus pts`,
  },
  mention_received: {
    label: "Mention received",
    icon: AtSign,
    example: "Each time someone @mentions this user",
    preview: (p) => `20 mentions = ${p * 20} pts`,
  },
};

export function SocialEarningForm({ initial, canEdit }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initial);
  const [busy, setBusy] = useState(false);

  const setActivity = (k: ActivityKey, patch: Partial<ActivityRow>) =>
    setForm((p) => ({
      ...p,
      activities: { ...p.activities, [k]: { ...p.activities[k], ...patch } },
    }));

  const save = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/settings/social-earning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? `HTTP ${res.status}`);
      toast.success("Social earning config saved");
      router.refresh();
    } catch (err) {
      toast.error("Save failed", {
        description: err instanceof Error ? err.message : "Try again",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white inline-flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-amber-400" />
          Social Earning
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Configure how authors earn points from views, likes, comments, etc. on
          their posts. Caps prevent runaway earning from viral content.
        </p>
      </div>

      {/* Master switch */}
      <div
        className={cn(
          "rounded-xl border p-5",
          form.enabled
            ? "border-emerald-500/30 bg-emerald-500/5"
            : "border-slate-700 bg-slate-900"
        )}
      >
        <label className="flex items-center gap-4 cursor-pointer">
          <Power
            className={cn(
              "w-6 h-6",
              form.enabled ? "text-emerald-400" : "text-slate-500"
            )}
          />
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-white">
              Master Switch — Social Earning is{" "}
              <span
                className={cn(
                  form.enabled ? "text-emerald-400" : "text-red-400"
                )}
              >
                {form.enabled ? "ENABLED" : "DISABLED"}
              </span>
            </p>
            <p className="text-xs text-slate-400">
              Off = no points fire from any social activity, regardless of the
              per-activity rates below.
            </p>
          </div>
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            disabled={!canEdit}
            className="w-5 h-5 rounded bg-slate-800 border-slate-600 text-emerald-500"
          />
        </label>
      </div>

      {/* Per-activity grid */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-base font-bold text-white mb-1">
          Per-activity rates
        </h2>
        <p className="text-xs text-slate-400 mb-4">
          Each activity has its own toggle. Disabled activities never award
          points even if the master switch is on.
        </p>
        <div className="space-y-2">
          {(Object.keys(ACTIVITY_META) as ActivityKey[]).map((k) => {
            const meta = ACTIVITY_META[k];
            const row = form.activities[k];
            const Icon = meta.icon;
            return (
              <div
                key={k}
                className={cn(
                  "rounded-lg border p-3 flex items-center gap-3 transition-colors",
                  row.enabled
                    ? "border-slate-700 bg-slate-950"
                    : "border-slate-800 bg-slate-900/30 opacity-60"
                )}
              >
                <input
                  type="checkbox"
                  checked={row.enabled}
                  onChange={(e) => setActivity(k, { enabled: e.target.checked })}
                  disabled={!canEdit}
                  className="rounded bg-slate-800 border-slate-600 text-blue-500"
                  aria-label={`Toggle ${meta.label}`}
                />
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 shrink-0">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">{meta.label}</p>
                  <p className="text-[11px] text-slate-500">{meta.example}</p>
                </div>
                <div className="shrink-0">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={row.points}
                      onChange={(e) =>
                        setActivity(k, {
                          points: Math.max(0, parseFloat(e.target.value) || 0),
                        })
                      }
                      disabled={!canEdit || !row.enabled}
                      className="w-20 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white tabular-nums focus:outline-none focus:border-blue-500 disabled:opacity-60"
                    />
                    <span className="text-xs text-slate-500">pts</span>
                  </div>
                  {row.enabled && row.points > 0 && (
                    <p className="text-[10px] text-emerald-400 mt-1 text-right">
                      {meta.preview(row.points)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Caps */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
        <h2 className="text-base font-bold text-white mb-1 inline-flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          Anti-abuse caps
        </h2>
        <p className="text-xs text-amber-200/80 mb-4">
          Hard limits to prevent gaming the system or runaway points from
          viral content.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Daily cap per user (pts)" hint="Max social earnings/day per user">
            <input
              type="number"
              min={0}
              value={form.daily_cap_per_user}
              onChange={(e) =>
                setForm({
                  ...form,
                  daily_cap_per_user: Math.max(0, parseInt(e.target.value) || 0),
                })
              }
              disabled={!canEdit}
              className={inp}
            />
          </Field>
          <Field label="Max earnings per post (pts)" hint="Cap per single post (any source)">
            <input
              type="number"
              min={0}
              value={form.cap_per_post}
              onChange={(e) =>
                setForm({
                  ...form,
                  cap_per_post: Math.max(0, parseInt(e.target.value) || 0),
                })
              }
              disabled={!canEdit}
              className={inp}
            />
          </Field>
          <Field label="Min account age (hours)" hint="Brand-new accounts can't earn">
            <input
              type="number"
              min={0}
              value={form.min_account_age_hours}
              onChange={(e) =>
                setForm({
                  ...form,
                  min_account_age_hours: Math.max(
                    0,
                    parseInt(e.target.value) || 0
                  ),
                })
              }
              disabled={!canEdit}
              className={inp}
            />
          </Field>
        </div>
      </div>

      {canEdit && (
        <div className="flex justify-end">
          <button
            onClick={save}
            disabled={busy}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Configuration
          </button>
        </div>
      )}
    </div>
  );
}

const inp =
  "w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 disabled:opacity-60";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">
        {label}
        {hint && <span className="text-slate-600 ml-1">· {hint}</span>}
      </label>
      {children}
    </div>
  );
}
