"use client";

import { confirmDialog } from "@/lib/confirm";

import { useEffect, useState } from "react";
import {
  Newspaper,
  Megaphone,
  Layers,
  BarChart3,
  Plus,
  Pencil,
  Trash2,
  Eye,
  MousePointer,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { ImageUploadField } from "@/components/admin/shared/ImageUploadField";
import { AD_PLACEMENTS } from "@/lib/ad-placements";

interface Campaign {
  id: string;
  title: string;
  description: string | null;
  budget: number;
  status: string;
  _count?: { ads: number };
}
interface Placement {
  id: string;
  name: string;
  isActive: boolean;
  _count?: { ads: number };
}
interface Ad {
  id: string;
  type: string;
  format: string;
  contentUrl: string | null;
  targetUrl: string | null;
  htmlContent: string | null;
  weight: number;
  status: string;
  impressions: number;
  clicks: number;
  rewardPoints: number;
  rewardCooldownSec: number;
  watchSeconds: number;
  headline: string | null;
  brandName: string | null;
  brandLogo: string | null;
  ctaLabel: string | null;
  targeting: { countries?: string[]; genders?: string[]; minLevel?: number } | null;
  campaign: { id: string; title: string };
  placement: { id: string; name: string };
}

const TABS = [
  { id: "ads", label: "Ads", icon: Newspaper },
  { id: "campaigns", label: "Campaigns", icon: Megaphone },
  { id: "placements", label: "Placements", icon: Layers },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
] as const;
type TabId = (typeof TABS)[number]["id"];

const PLACEMENT_LABEL = Object.fromEntries(AD_PLACEMENTS.map((p) => [p.name, p.label]));

export function AdManagerView({ canManage }: { canManage: boolean }) {
  const [tab, setTab] = useState<TabId>("ads");
  const [ads, setAds] = useState<Ad[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [loading, setLoading] = useState(true);
  const [adModal, setAdModal] = useState<Ad | "new" | null>(null);
  const [campModal, setCampModal] = useState<Campaign | "new" | null>(null);
  const [newPlacement, setNewPlacement] = useState("");

  const loadAll = async () => {
    setLoading(true);
    try {
      const [a, c, p] = await Promise.all([
        fetch("/api/admin/ads").then((r) => r.json()),
        fetch("/api/admin/ads/campaigns").then((r) => r.json()),
        fetch("/api/admin/ads/placements").then((r) => r.json()),
      ]);
      setAds(a.ads ?? []);
      setCampaigns(c.campaigns ?? []);
      setPlacements(p.placements ?? []);
    } catch {
      toast.error("Failed to load ad data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/admin/ads").then((r) => r.json()),
      fetch("/api/admin/ads/campaigns").then((r) => r.json()),
      fetch("/api/admin/ads/placements").then((r) => r.json()),
    ])
      .then(([a, c, p]) => {
        if (!active) return;
        setAds(a.ads ?? []);
        setCampaigns(c.campaigns ?? []);
        setPlacements(p.placements ?? []);
      })
      .catch(() => active && toast.error("Failed to load ad data"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const totalImpr = ads.reduce((s, a) => s + a.impressions, 0);
  const totalClicks = ads.reduce((s, a) => s + a.clicks, 0);
  const ctr = totalImpr > 0 ? ((totalClicks / totalImpr) * 100).toFixed(2) : "0.00";

  const deletePlacement = async (id: string) => {
    if (!(await confirmDialog({ title: "Delete this placement?", tone: "danger", confirmLabel: "Delete" }))) return;
    const res = await fetch(`/api/admin/ads/placements/${id}`, { method: "DELETE" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(d.error ?? "Failed");
    toast.success("Deleted");
    loadAll();
  };
  const togglePlacement = async (p: Placement) => {
    await fetch(`/api/admin/ads/placements/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !p.isActive }),
    });
    loadAll();
  };
  const addPlacement = async () => {
    if (!newPlacement.trim()) return;
    const res = await fetch("/api/admin/ads/placements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newPlacement }),
    });
    if (!res.ok) return toast.error("Failed");
    setNewPlacement("");
    toast.success("Placement added");
    loadAll();
  };
  const deleteAd = async (id: string) => {
    if (!(await confirmDialog({ title: "Delete this ad?", tone: "danger", confirmLabel: "Delete" }))) return;
    await fetch(`/api/admin/ads/${id}`, { method: "DELETE" });
    toast.success("Deleted");
    loadAll();
  };
  const deleteCampaign = async (id: string) => {
    if (!(await confirmDialog({ title: "Delete campaign and all its ads?", tone: "danger", confirmLabel: "Delete" }))) return;
    await fetch(`/api/admin/ads/campaigns/${id}`, { method: "DELETE" });
    toast.success("Deleted");
    loadAll();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white inline-flex items-center gap-2">
            <Newspaper className="w-6 h-6 text-amber-400" />
            Ads Manager
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage ads, campaigns, and placement slots across the platform.
          </p>
        </div>
        {canManage && tab === "ads" && (
          <button
            onClick={() => setAdModal("new")}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" /> New Ad
          </button>
        )}
        {canManage && tab === "campaigns" && (
          <button
            onClick={() => setCampModal("new")}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" /> New Campaign
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<Eye className="w-5 h-5" />} value={totalImpr.toLocaleString()} label="Impressions" />
        <StatCard icon={<MousePointer className="w-5 h-5" />} value={totalClicks.toLocaleString()} label="Clicks" />
        <StatCard icon={<BarChart3 className="w-5 h-5" />} value={`${ctr}%`} label="CTR" />
        <StatCard icon={<Newspaper className="w-5 h-5" />} value={String(ads.length)} label="Ads" />
      </div>

      <div className="flex gap-1 border-b border-slate-800 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 whitespace-nowrap ${
              tab === t.id
                ? "border-blue-500 text-white"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
        </div>
      ) : (
        <>
          {tab === "ads" && (
            <div className="space-y-2">
              {ads.length === 0 && <Empty text="No ads yet. Create one to start." />}
              {ads.map((ad) => (
                <div key={ad.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900 p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {ad.contentUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={ad.contentUrl} alt="" className="w-14 h-10 rounded object-cover bg-slate-950 shrink-0" />
                    ) : (
                      <div className="w-14 h-10 rounded bg-slate-950 grid place-items-center text-slate-600 text-[10px] shrink-0">{ad.type}</div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{ad.campaign.title}</p>
                      <p className="text-xs text-slate-400">
                        {PLACEMENT_LABEL[ad.placement.name] ?? ad.placement.name} · w{ad.weight} · {ad.status}
                        {ad.rewardPoints > 0 && ` · +${ad.rewardPoints}pts`}
                      </p>
                      <p className="text-[11px] text-slate-500">{ad.impressions} impr · {ad.clicks} clicks</p>
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex gap-1">
                      <IconBtn onClick={() => setAdModal(ad)} title="Edit"><Pencil className="w-4 h-4" /></IconBtn>
                      <IconBtn onClick={() => deleteAd(ad.id)} title="Delete" danger><Trash2 className="w-4 h-4" /></IconBtn>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {tab === "campaigns" && (
            <div className="space-y-2">
              {campaigns.length === 0 && <Empty text="No campaigns yet." />}
              {campaigns.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900 p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{c.title}</p>
                    <p className="text-xs text-slate-400">
                      ${c.budget.toFixed(2)} · {c.status} · {c._count?.ads ?? 0} ads
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex gap-1">
                      <IconBtn onClick={() => setCampModal(c)} title="Edit"><Pencil className="w-4 h-4" /></IconBtn>
                      <IconBtn onClick={() => deleteCampaign(c.id)} title="Delete" danger><Trash2 className="w-4 h-4" /></IconBtn>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {tab === "placements" && (
            <div className="space-y-3">
              {canManage && (
                <div className="flex gap-2">
                  <input
                    value={newPlacement}
                    onChange={(e) => setNewPlacement(e.target.value)}
                    placeholder="NEW_PLACEMENT_NAME"
                    className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                  />
                  <button onClick={addPlacement} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold">Add</button>
                </div>
              )}
              {placements.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900 p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{PLACEMENT_LABEL[p.name] ?? p.name}</p>
                    <p className="text-xs text-slate-500 font-mono">{p.name} · {p._count?.ads ?? 0} ads</p>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => togglePlacement(p)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${p.isActive ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-800 text-slate-400"}`}
                      >
                        {p.isActive ? "Active" : "Inactive"}
                      </button>
                      <IconBtn onClick={() => deletePlacement(p.id)} title="Delete" danger><Trash2 className="w-4 h-4" /></IconBtn>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {tab === "analytics" && <AnalyticsTab />}
        </>
      )}

      {adModal && (
        <AdModal
          ad={adModal === "new" ? null : adModal}
          campaigns={campaigns}
          placements={placements}
          onClose={() => setAdModal(null)}
          onSaved={() => {
            setAdModal(null);
            loadAll();
          }}
        />
      )}
      {campModal && (
        <CampaignModal
          campaign={campModal === "new" ? null : campModal}
          onClose={() => setCampModal(null)}
          onSaved={() => {
            setCampModal(null);
            loadAll();
          }}
        />
      )}
    </div>
  );
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="text-slate-400">{icon}</div>
      <p className="text-xl font-bold text-white mt-2">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <p className="text-sm text-slate-500 py-8 text-center">{text}</p>;
}

interface DayStat { date: string; impressions: number; clicks: number; spendUsd: number }
function AnalyticsTab() {
  const [series, setSeries] = useState<DayStat[]>([]);
  const [totals, setTotals] = useState({ impressions: 0, clicks: 0, ctr: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/ads/analytics?days=14")
      .then((r) => r.json())
      .then((d) => {
        setSeries(d.series ?? []);
        setTotals(d.totals ?? { impressions: 0, clicks: 0, ctr: 0 });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const maxImp = Math.max(1, ...series.map((s) => s.impressions));
  const spend = series.reduce((s, d) => s + d.spendUsd, 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={<Eye className="w-5 h-5" />} value={totals.impressions.toLocaleString()} label="Impressions (all time)" />
        <StatCard icon={<MousePointer className="w-5 h-5" />} value={totals.clicks.toLocaleString()} label="Clicks (all time)" />
        <StatCard icon={<BarChart3 className="w-5 h-5" />} value={`${totals.ctr.toFixed(2)}%`} label="CTR" />
        <StatCard icon={<BarChart3 className="w-5 h-5" />} value={`$${spend.toFixed(2)}`} label="Spend (14d)" />
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-3">Impressions · last 14 days</p>
        {loading ? (
          <p className="text-xs text-slate-500 py-6 text-center">Loading…</p>
        ) : series.every((s) => s.impressions === 0) ? (
          <p className="text-xs text-slate-500 py-6 text-center">No impressions in this window yet.</p>
        ) : (
          <div className="flex items-end gap-1 h-28">
            {series.map((s) => (
              <div key={s.date} className="flex-1" title={`${s.date}: ${s.impressions} impr, ${s.clicks} clicks, $${s.spendUsd.toFixed(2)}`}>
                <div className="w-full rounded-t bg-linear-to-t from-blue-600 to-indigo-500" style={{ height: `${(s.impressions / maxImp) * 100}%` }} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
function IconBtn({ children, onClick, title, danger }: { children: React.ReactNode; onClick: () => void; title: string; danger?: boolean }) {
  return (
    <button onClick={onClick} title={title} className={`p-2 rounded-lg bg-slate-800 hover:bg-slate-700 ${danger ? "text-red-400" : "text-slate-300"}`}>
      {children}
    </button>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-y-auto">
      <div className="w-full max-w-lg my-8 rounded-2xl border border-slate-800 bg-slate-900">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <h3 className="font-bold text-white">{title}</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

const inputCls = "w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500";

function AdModal({
  ad,
  campaigns,
  placements,
  onClose,
  onSaved,
}: {
  ad: Ad | null;
  campaigns: Campaign[];
  placements: Placement[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [campaignId, setCampaignId] = useState(ad?.campaign.id ?? campaigns[0]?.id ?? "");
  const [placementId, setPlacementId] = useState(ad?.placement.id ?? placements[0]?.id ?? "");
  const [type, setType] = useState(ad?.type ?? "LOCAL");
  const [contentUrl, setContentUrl] = useState(ad?.contentUrl ?? "");
  const [targetUrl, setTargetUrl] = useState(ad?.targetUrl ?? "");
  const [htmlContent, setHtmlContent] = useState(ad?.htmlContent ?? "");
  const [weight, setWeight] = useState(String(ad?.weight ?? 10));
  const [status, setStatus] = useState(ad?.status ?? "ACTIVE");
  const [rewardPoints, setRewardPoints] = useState(String(ad?.rewardPoints ?? 0));
  const [watchSeconds, setWatchSeconds] = useState(String(ad?.watchSeconds ?? 15));
  // Native (post-like feed ad) fields
  const [format, setFormat] = useState(ad?.format ?? "BANNER");
  const [headline, setHeadline] = useState(ad?.headline ?? "");
  const [brandName, setBrandName] = useState(ad?.brandName ?? "");
  const [brandLogo, setBrandLogo] = useState(ad?.brandLogo ?? "");
  const [ctaLabel, setCtaLabel] = useState(ad?.ctaLabel ?? "");
  // Targeting
  const [tgCountry, setTgCountry] = useState(ad?.targeting?.countries?.[0] ?? "");
  const [tgGenders, setTgGenders] = useState<string[]>(ad?.targeting?.genders ?? []);
  const [tgMinLevel, setTgMinLevel] = useState(String(ad?.targeting?.minLevel ?? 0));
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!campaignId || !placementId) {
      toast.error("Pick a campaign and placement");
      return;
    }
    setBusy(true);
    try {
      const targeting: Record<string, unknown> = {};
      if (tgCountry.trim()) targeting.countries = [tgCountry.trim()];
      if (tgGenders.length) targeting.genders = tgGenders;
      if (Number(tgMinLevel) > 0) targeting.minLevel = Number(tgMinLevel);
      const payload = {
        campaignId,
        placementId,
        type,
        format,
        contentUrl,
        targetUrl,
        htmlContent,
        weight: Number(weight) || 10,
        status,
        rewardPoints: Number(rewardPoints) || 0,
        watchSeconds: Number(watchSeconds) || 15,
        headline,
        brandName,
        brandLogo,
        ctaLabel,
        targeting,
      };
      const res = await fetch(ad ? `/api/admin/ads/${ad.id}` : "/api/admin/ads", {
        method: ad ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error);
      toast.success(ad ? "Ad updated" : "Ad created");
      onSaved();
    } catch (err) {
      toast.error("Failed", { description: err instanceof Error ? err.message : "Try again" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell title={ad ? "Edit Ad" : "New Ad"} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Campaign</label>
            <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className={inputCls}>
              {campaigns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Placement</label>
            <select value={placementId} onChange={(e) => setPlacementId(e.target.value)} className={inputCls}>
              {placements.map((p) => <option key={p.id} value={p.id}>{PLACEMENT_LABEL[p.name] ?? p.name}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Type</label>
          <div className="flex gap-2">
            {["LOCAL", "HTML"].map((t) => (
              <button key={t} onClick={() => setType(t)} className={`flex-1 py-2 rounded-lg text-sm font-semibold ${type === t ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300"}`}>
                {t === "LOCAL" ? "Image" : "HTML"}
              </button>
            ))}
          </div>
        </div>

        {type === "HTML" ? (
          <div>
            <label className="block text-xs text-slate-400 mb-1">HTML content</label>
            <textarea value={htmlContent} onChange={(e) => setHtmlContent(e.target.value)} rows={4} className={inputCls} placeholder="<div>...</div>" />
          </div>
        ) : (
          <div>
            <label className="block text-xs text-slate-400 mb-1">Ad image</label>
            <ImageUploadField value={contentUrl} onChange={setContentUrl} previewSize="md" />
          </div>
        )}

        <div>
          <label className="block text-xs text-slate-400 mb-1">Target URL (click destination)</label>
          <input value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} placeholder="https://..." className={inputCls} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Weight</label>
            <input type="number" min={1} value={weight} onChange={(e) => setWeight(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
              <option value="ACTIVE">Active</option>
              <option value="PAUSED">Paused</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>

        {/* Format — Banner vs Native (post-like feed ad) */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Format</label>
          <div className="flex gap-2">
            {["BANNER", "NATIVE"].map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold ${format === f ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300"}`}
              >
                {f === "BANNER" ? "Banner" : "Native (feed)"}
              </button>
            ))}
          </div>
          {format === "NATIVE" && (
            <p className="text-[11px] text-slate-500 mt-1">
              Native ads render as post-like cards in the social feed (placement IN_FEED).
            </p>
          )}
        </div>

        {format === "NATIVE" && (
          <div className="rounded-lg border border-slate-800 p-3 space-y-2.5">
            <p className="text-xs font-bold text-slate-400">Native creative</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Brand name</label>
                <input value={brandName} onChange={(e) => setBrandName(e.target.value)} className={inputCls} placeholder="e.g. NordVPN" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">CTA label</label>
                <input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} className={inputCls} placeholder="Learn More" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Brand logo</label>
              <ImageUploadField value={brandLogo} onChange={setBrandLogo} previewSize="square" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Headline / ad copy</label>
              <textarea value={headline} onChange={(e) => setHeadline(e.target.value)} rows={3} className={inputCls} placeholder="What are you promoting?" />
            </div>
          </div>
        )}

        {/* Targeting */}
        <div className="rounded-lg border border-slate-800 p-3 space-y-2.5">
          <p className="text-xs font-bold text-slate-400">Targeting (optional)</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Country</label>
              <input value={tgCountry} onChange={(e) => setTgCountry(e.target.value)} className={inputCls} placeholder="Any" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Min level</label>
              <input type="number" min={0} value={tgMinLevel} onChange={(e) => setTgMinLevel(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Gender</label>
            <div className="flex gap-1.5">
              {["MALE", "FEMALE", "OTHER"].map((g) => {
                const on = tgGenders.includes(g);
                return (
                  <button
                    key={g}
                    onClick={() => setTgGenders((prev) => (on ? prev.filter((x) => x !== g) : [...prev, g]))}
                    className={`flex-1 py-1.5 rounded-md text-[11px] font-semibold capitalize ${on ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300"}`}
                  >
                    {g.toLowerCase()}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 p-3">
          <p className="text-xs font-bold text-slate-400 mb-2">Reward (Watch &amp; Earn — optional)</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Reward points</label>
              <input type="number" min={0} value={rewardPoints} onChange={(e) => setRewardPoints(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Watch seconds</label>
              <input type="number" min={1} value={watchSeconds} onChange={(e) => setWatchSeconds(e.target.value)} className={inputCls} />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Set reward points &gt; 0 to make this ad appear on the &quot;Watch &amp; Earn&quot; page.</p>
        </div>

        <button onClick={save} disabled={busy} className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-50">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          {ad ? "Save changes" : "Create ad"}
        </button>
      </div>
    </ModalShell>
  );
}

function CampaignModal({ campaign, onClose, onSaved }: { campaign: Campaign | null; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(campaign?.title ?? "");
  const [description, setDescription] = useState(campaign?.description ?? "");
  const [budget, setBudget] = useState(String(campaign?.budget ?? 0));
  const [status, setStatus] = useState(campaign?.status ?? "ACTIVE");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (title.trim().length < 2) {
      toast.error("Enter a title");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(campaign ? `/api/admin/ads/campaigns/${campaign.id}` : "/api/admin/ads/campaigns", {
        method: campaign ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, budget: Number(budget) || 0, status }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error);
      toast.success(campaign ? "Campaign updated" : "Campaign created");
      onSaved();
    } catch (err) {
      toast.error("Failed", { description: err instanceof Error ? err.message : "Try again" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell title={campaign ? "Edit Campaign" : "New Campaign"} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Budget ($)</label>
            <input type="number" min={0} value={budget} onChange={(e) => setBudget(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
              <option value="ACTIVE">Active</option>
              <option value="PAUSED">Paused</option>
              <option value="ENDED">Ended</option>
            </select>
          </div>
        </div>
        <button onClick={save} disabled={busy} className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-50">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          {campaign ? "Save changes" : "Create campaign"}
        </button>
      </div>
    </ModalShell>
  );
}
