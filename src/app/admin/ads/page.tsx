import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasPermission, type UserRole } from "@/lib/rbac";
import {
  Newspaper,
  Layers,
  Megaphone,
  Globe,
  BarChart3,
  Eye,
  MousePointer,
  Plus,
} from "lucide-react";
import Link from "next/link";

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

const TABS = [
  { id: "ads", label: "Ads", icon: Newspaper },
  { id: "campaigns", label: "Campaigns", icon: Megaphone },
  { id: "placements", label: "Placements", icon: Layers },
  { id: "networks", label: "Networks", icon: Globe },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default async function AdsAdminPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const adminRole = session.user.role as UserRole | undefined;
  if (!hasPermission(adminRole, "ads.view")) redirect("/admin");

  const params = await searchParams;
  const tab: TabId = (TABS.find((t) => t.id === params.tab)?.id ?? "ads") as TabId;
  const canManage = hasPermission(adminRole, "ads.manage");

  const [adStats, ads, campaigns, placements, networks] = await Promise.all([
    prisma.ad.aggregate({
      _sum: { impressions: true, clicks: true },
      _count: { _all: true },
    }),
    tab === "ads"
      ? prisma.ad.findMany({
          orderBy: { createdAt: "desc" },
          take: 50,
          include: {
            campaign: { select: { id: true, title: true } },
            placement: { select: { id: true, name: true } },
          },
        })
      : Promise.resolve([]),
    tab === "campaigns" || tab === "ads"
      ? prisma.adCampaign.findMany({
          orderBy: { createdAt: "desc" },
          include: { _count: { select: { ads: true } } },
        })
      : Promise.resolve([]),
    tab === "placements" || tab === "ads"
      ? prisma.adPlacement.findMany({ orderBy: { name: "asc" } })
      : Promise.resolve([]),
    tab === "networks"
      ? prisma.adNetwork.findMany({ orderBy: { globalWeight: "desc" } })
      : Promise.resolve([]),
  ]);

  const totalImpressions = adStats._sum.impressions ?? 0;
  const totalClicks = adStats._sum.clicks ?? 0;
  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const activeCampaigns = (
    campaigns as Array<{ status: string }>
  ).filter((c) => c.status === "ACTIVE").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white inline-flex items-center gap-2">
            <Newspaper className="w-6 h-6 text-amber-400" />
            Ads Manager
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage ads, campaigns, placements, networks, and analytics.
          </p>
        </div>
        {canManage && (
          <Link
            href={`/admin/ads?tab=${tab}&new=1`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            New {tab === "ads" ? "Ad" : tab.slice(0, -1)}
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat
          icon={<Eye className="w-5 h-5" />}
          tone="blue"
          value={totalImpressions.toLocaleString()}
          label="Impressions"
        />
        <Stat
          icon={<MousePointer className="w-5 h-5" />}
          tone="emerald"
          value={totalClicks.toLocaleString()}
          label="Clicks"
        />
        <Stat
          icon={<BarChart3 className="w-5 h-5" />}
          tone="purple"
          value={ctr.toFixed(2) + "%"}
          label="CTR"
        />
        <Stat
          icon={<Megaphone className="w-5 h-5" />}
          tone="amber"
          value={activeCampaigns}
          label="Active Campaigns"
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-800 flex gap-1 overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <Link
              key={t.id}
              href={t.id === "ads" ? "/admin/ads" : `/admin/ads?tab=${t.id}`}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px inline-flex items-center gap-2 ${
                tab === t.id
                  ? "border-blue-500 text-white"
                  : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </Link>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === "ads" && (
        <TabSection
          empty={ads.length === 0}
          emptyIcon={<Newspaper className="w-12 h-12" />}
          emptyTitle="No ads yet"
          emptyHint="Create an ad to start tracking impressions and clicks."
        >
          <AdsTable ads={ads as never} />
        </TabSection>
      )}

      {tab === "campaigns" && (
        <TabSection
          empty={campaigns.length === 0}
          emptyIcon={<Megaphone className="w-12 h-12" />}
          emptyTitle="No campaigns yet"
        >
          <CampaignsList campaigns={campaigns as never} />
        </TabSection>
      )}

      {tab === "placements" && (
        <TabSection
          empty={placements.length === 0}
          emptyIcon={<Layers className="w-12 h-12" />}
          emptyTitle="No placements"
          emptyHint="Add placement zones (e.g. Homepage, Feed Top)."
        >
          <PlacementsTable placements={placements as never} />
        </TabSection>
      )}

      {tab === "networks" && (
        <TabSection
          empty={networks.length === 0}
          emptyIcon={<Globe className="w-12 h-12" />}
          emptyTitle="No ad networks configured"
          emptyHint="Add networks (Google AdSense, PropellerAds, etc.)."
        >
          <NetworksList networks={networks as never} />
        </TabSection>
      )}

      {tab === "analytics" && (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            Performance Overview
          </h2>
          <p className="text-sm text-slate-400 mb-4">
            Detailed event-level analytics ship in Phase 5 with the Analytics
            module. For now, see the totals above and per-ad row counts in the
            Ads tab.
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-slate-950/50 border border-slate-800 p-4">
              <p className="text-xs text-slate-500">Impressions</p>
              <p className="text-2xl font-bold text-white tabular-nums">
                {totalImpressions.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg bg-slate-950/50 border border-slate-800 p-4">
              <p className="text-xs text-slate-500">Clicks</p>
              <p className="text-2xl font-bold text-white tabular-nums">
                {totalClicks.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg bg-slate-950/50 border border-slate-800 p-4">
              <p className="text-xs text-slate-500">CTR</p>
              <p className="text-2xl font-bold text-white tabular-nums">
                {ctr.toFixed(2)}%
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  icon,
  tone,
  value,
  label,
}: {
  icon: React.ReactNode;
  tone: "blue" | "emerald" | "purple" | "amber";
  value: string | number;
  label: string;
}) {
  const cls = {
    blue: "bg-blue-500/10 text-blue-400",
    emerald: "bg-emerald-500/10 text-emerald-400",
    purple: "bg-purple-500/10 text-purple-400",
    amber: "bg-amber-500/10 text-amber-400",
  }[tone];
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${cls}`}>{icon}</div>
        <div>
          <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
          <p className="text-sm text-slate-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

function TabSection({
  empty,
  emptyIcon,
  emptyTitle,
  emptyHint,
  children,
}: {
  empty: boolean;
  emptyIcon: React.ReactNode;
  emptyTitle: string;
  emptyHint?: string;
  children: React.ReactNode;
}) {
  if (empty) {
    return (
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-16 text-center">
        <div className="text-slate-600 mx-auto mb-4 inline-block">
          {emptyIcon}
        </div>
        <h3 className="text-lg font-medium text-white mb-1">{emptyTitle}</h3>
        {emptyHint && <p className="text-sm text-slate-400">{emptyHint}</p>}
      </div>
    );
  }
  return <>{children}</>;
}

function AdsTable({
  ads,
}: {
  ads: Array<{
    id: string;
    type: string;
    format: string;
    status: string;
    impressions: number;
    clicks: number;
    campaign: { title: string } | null;
    placement: { name: string } | null;
  }>;
}) {
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
      <table className="w-full">
        <thead className="bg-slate-800/50 border-b border-slate-800">
          <tr>
            <th className="text-left py-3 px-6 text-sm font-medium text-slate-400">
              Campaign
            </th>
            <th className="text-left py-3 px-6 text-sm font-medium text-slate-400">
              Type · Format
            </th>
            <th className="text-left py-3 px-6 text-sm font-medium text-slate-400">
              Placement
            </th>
            <th className="text-left py-3 px-6 text-sm font-medium text-slate-400">
              Status
            </th>
            <th className="text-left py-3 px-6 text-sm font-medium text-slate-400">
              Impressions
            </th>
            <th className="text-left py-3 px-6 text-sm font-medium text-slate-400">
              Clicks
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {ads.map((a) => (
            <tr key={a.id} className="hover:bg-slate-800/40">
              <td className="py-3 px-6 text-white">
                {a.campaign?.title ?? "—"}
              </td>
              <td className="py-3 px-6 text-sm text-slate-300">
                {a.type} · {a.format}
              </td>
              <td className="py-3 px-6 text-sm text-slate-300">
                {a.placement?.name ?? "—"}
              </td>
              <td className="py-3 px-6">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    a.status === "ACTIVE"
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-slate-700 text-slate-400"
                  }`}
                >
                  {a.status}
                </span>
              </td>
              <td className="py-3 px-6 tabular-nums">
                {a.impressions.toLocaleString()}
              </td>
              <td className="py-3 px-6 tabular-nums">
                {a.clicks.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CampaignsList({
  campaigns,
}: {
  campaigns: Array<{
    id: string;
    title: string;
    description: string | null;
    budget: number;
    status: string;
    _count: { ads: number };
  }>;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {campaigns.map((c) => (
        <div
          key={c.id}
          className="rounded-xl border border-slate-800 bg-slate-900 p-5"
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-white font-semibold">{c.title}</h3>
            <span
              className={`px-2 py-0.5 rounded-full text-xs ${
                c.status === "ACTIVE"
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-slate-700 text-slate-400"
              }`}
            >
              {c.status}
            </span>
          </div>
          {c.description && (
            <p className="text-sm text-slate-400 mb-3 line-clamp-2">
              {c.description}
            </p>
          )}
          <div className="flex items-center justify-between text-sm">
            <span className="text-amber-400 font-bold tabular-nums">
              ${c.budget.toFixed(2)}
            </span>
            <span className="text-slate-500">{c._count.ads} ads</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function PlacementsTable({
  placements,
}: {
  placements: Array<{
    id: string;
    name: string;
    platform: string;
    isActive: boolean;
  }>;
}) {
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
      <table className="w-full">
        <thead className="bg-slate-800/50 border-b border-slate-800">
          <tr>
            <th className="text-left py-3 px-6 text-sm font-medium text-slate-400">
              Name
            </th>
            <th className="text-left py-3 px-6 text-sm font-medium text-slate-400">
              Platform
            </th>
            <th className="text-left py-3 px-6 text-sm font-medium text-slate-400">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {placements.map((p) => (
            <tr key={p.id} className="hover:bg-slate-800/40">
              <td className="py-3 px-6 text-white">{p.name}</td>
              <td className="py-3 px-6 text-sm text-slate-300">{p.platform}</td>
              <td className="py-3 px-6">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs ${
                    p.isActive
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-slate-700 text-slate-400"
                  }`}
                >
                  {p.isActive ? "Active" : "Inactive"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NetworksList({
  networks,
}: {
  networks: Array<{
    id: string;
    name: string;
    providerKey: string;
    isEnabledWeb: boolean;
    isEnabledMobile: boolean;
    globalWeight: number;
  }>;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {networks.map((n) => (
        <div
          key={n.id}
          className="rounded-xl border border-slate-800 bg-slate-900 p-5"
        >
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-white font-semibold">{n.name}</p>
              <p className="text-xs text-slate-500 font-mono">{n.providerKey}</p>
            </div>
            <span className="text-xs text-slate-400">
              Weight: {n.globalWeight}
            </span>
          </div>
          <div className="flex gap-2 text-xs">
            <span
              className={`px-2 py-0.5 rounded-full ${
                n.isEnabledWeb
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-slate-700 text-slate-400"
              }`}
            >
              Web {n.isEnabledWeb ? "ON" : "OFF"}
            </span>
            <span
              className={`px-2 py-0.5 rounded-full ${
                n.isEnabledMobile
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-slate-700 text-slate-400"
              }`}
            >
              Mobile {n.isEnabledMobile ? "ON" : "OFF"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
