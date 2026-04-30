import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasPermission, type UserRole } from "@/lib/rbac";
import { MessageSquare, Flag, Trash2, Ban } from "lucide-react";
import { ReportActions } from "@/components/admin/social/report-actions";
import { format } from "date-fns";
import Link from "next/link";

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function SocialModerationPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const adminRole = session.user.role as UserRole | undefined;
  if (!hasPermission(adminRole, "social.moderate")) redirect("/admin");

  const params = await searchParams;
  const status = params.status === "RESOLVED" ? "RESOLVED" : "PENDING";

  const [reports, todayPosts, pending, autoRemoved] = await Promise.all([
    prisma.socialReport.findMany({
      where: { status },
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
      take: 50,
    }),
    prisma.post.count({
      where: {
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    }),
    prisma.socialReport.count({ where: { status: "PENDING" } }),
    prisma.socialReport.count({
      where: { status: "RESOLVED", resolution: "DELETED" },
    }),
  ]);

  // Resolve reporter info
  const reporterIds = Array.from(new Set(reports.map((r) => r.reporterId)));
  const reporters = reporterIds.length
    ? await prisma.user.findMany({
        where: { id: { in: reporterIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const reporterMap = new Map(reporters.map((u) => [u.id, u]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white inline-flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-pink-400" />
          Social Feed Moderation
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Review reported posts, comments, listings, and users.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Stat
          icon={<MessageSquare className="w-5 h-5" />}
          tone="blue"
          value={todayPosts}
          label="Posts Today"
        />
        <Stat
          icon={<Flag className="w-5 h-5" />}
          tone="amber"
          value={pending}
          label="Pending Reports"
        />
        <Stat
          icon={<Trash2 className="w-5 h-5" />}
          tone="red"
          value={autoRemoved}
          label="Removed (all-time)"
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-800 flex gap-1">
        <Link
          href="/admin/social-moderation"
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${
            status === "PENDING"
              ? "border-blue-500 text-white"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          Pending ({pending})
        </Link>
        <Link
          href="/admin/social-moderation?status=RESOLVED"
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${
            status === "RESOLVED"
              ? "border-blue-500 text-white"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          Resolved
        </Link>
      </div>

      {/* Reports list */}
      {reports.length === 0 ? (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-16 text-center">
          <Flag className="w-12 h-12 mx-auto mb-4 text-slate-600" />
          <h3 className="text-lg font-medium text-white mb-1">
            {status === "PENDING"
              ? "No pending reports"
              : "No resolved reports"}
          </h3>
          <p className="text-sm text-slate-400">
            Reports will appear here when users flag content.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => {
            const reporter = reporterMap.get(r.reporterId);
            const priorityCls =
              r.priority === "URGENT"
                ? "border-red-500/50 bg-red-500/5"
                : r.priority === "HIGH"
                ? "border-orange-500/50 bg-orange-500/5"
                : "border-blue-500/30 bg-blue-500/5";
            return (
              <div
                key={r.id}
                className={`rounded-xl border-l-4 ${priorityCls} bg-slate-900 border-y border-r border-slate-800 p-5`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-xs font-medium">
                      {r.contentType}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        r.priority === "URGENT"
                          ? "bg-red-500/15 text-red-400"
                          : r.priority === "HIGH"
                          ? "bg-orange-500/15 text-orange-400"
                          : "bg-blue-500/15 text-blue-400"
                      }`}
                    >
                      {r.priority}
                    </span>
                    <span className="text-xs text-slate-500">
                      Reason: {r.reason}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">
                    {format(r.createdAt, "MMM d, HH:mm")}
                  </span>
                </div>
                <p className="text-sm text-white mb-2">
                  Content ID:{" "}
                  <code className="font-mono text-xs text-slate-400">
                    {r.contentId}
                  </code>
                </p>
                {r.details && (
                  <p className="text-sm text-slate-400 mb-3">{r.details}</p>
                )}
                <p className="text-xs text-slate-500 mb-3">
                  Reported by{" "}
                  <span className="text-slate-300">
                    {reporter?.name ?? reporter?.email ?? "unknown"}
                  </span>
                </p>

                {r.status === "PENDING" ? (
                  <ReportActions reportId={r.id} contentType={r.contentType} />
                ) : (
                  <div className="text-xs text-slate-400">
                    Resolved with{" "}
                    <span className="text-white font-medium">
                      {r.resolution}
                    </span>
                    {r.resolverNote && (
                      <span> — &ldquo;{r.resolverNote}&rdquo;</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Decorative Ban icon */}
      <Ban className="hidden" />
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
  tone: "blue" | "amber" | "red";
  value: number;
  label: string;
}) {
  const cls = {
    blue: "bg-blue-500/10 text-blue-400",
    amber: "bg-amber-500/10 text-amber-400",
    red: "bg-red-500/10 text-red-400",
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
