import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasPermission, type UserRole } from "@/lib/rbac";
import { UserCog, ClipboardList, Inbox, ShieldOff } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { TutorRowActions } from "./_components/TutorRowActions";

export default async function AdminTutorsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role as UserRole | undefined;
  if (!hasPermission(role, "tutor.applications.review")) redirect("/admin");

  const [tutorsRaw, pendingApps, totalTutors, suspendedTutors] = await Promise.all([
    prisma.tutorProfile.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            role: true,
            cashBalance: true,
            createdAt: true,
          },
        },
      },
    }),
    prisma.tutorApplication.count({ where: { status: "PENDING" } }),
    prisma.tutorProfile.count(),
    prisma.tutorProfile.count({ where: { isSuspended: true } }),
  ]);

  // Prisma Accelerate's TS types collapse `include` payloads to the base
  // model shape; assert the include here so JSX field access compiles.
  const tutors = tutorsRaw as unknown as Array<{
    id: string;
    headline: string | null;
    totalCourses: number;
    totalEarningsCents: number;
    isSuspended: boolean;
    createdAt: Date;
    user: {
      id: string;
      name: string | null;
      email: string | null;
      avatar: string | null;
      role: string;
      cashBalance: number;
      createdAt: Date;
    };
  }>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white inline-flex items-center gap-2">
            <UserCog className="w-6 h-6 text-teal-300" />
            Tutors
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage approved tutors and review pending applications.
          </p>
        </div>
        <Link
          href="/admin/tutors/applications"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
        >
          <Inbox className="w-4 h-4" />
          Applications
          {pendingApps > 0 && (
            <span className="ml-1 px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-200 text-xs">
              {pendingApps}
            </span>
          )}
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard
          icon={<UserCog className="w-4 h-4" />}
          label="Total tutors"
          value={totalTutors}
          tone="text-teal-300"
        />
        <StatCard
          icon={<ClipboardList className="w-4 h-4" />}
          label="Pending applications"
          value={pendingApps}
          tone="text-amber-300"
        />
        <StatCard
          icon={<ShieldOff className="w-4 h-4" />}
          label="Suspended"
          value={suspendedTutors}
          tone="text-rose-300"
        />
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-950 text-slate-400 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">Tutor</th>
                <th className="text-left px-4 py-3">Headline</th>
                <th className="text-left px-4 py-3">Courses</th>
                <th className="text-left px-4 py-3">Earnings</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Joined</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {tutors.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500">
                    No tutors yet. Approve an application to add the first one.
                  </td>
                </tr>
              )}
              {tutors.map((t) => (
                <tr key={t.id} className="hover:bg-slate-800/40">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {t.user.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={t.user.avatar}
                          alt=""
                          className="w-8 h-8 rounded-full object-cover bg-slate-800"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs text-slate-200 font-bold">
                          {(t.user.name ?? t.user.email ?? "?")
                            .slice(0, 1)
                            .toUpperCase()}
                        </div>
                      )}
                      <div className="leading-tight">
                        <p className="text-white font-medium">
                          {t.user.name ?? "—"}
                        </p>
                        <p className="text-xs text-slate-500">{t.user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-300 max-w-[260px] truncate">
                    {t.headline ?? <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-300 tabular-nums">
                    {t.totalCourses}
                  </td>
                  <td className="px-4 py-3 text-emerald-300 tabular-nums">
                    ${(t.totalEarningsCents / 100).toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    {t.isSuspended ? (
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 text-xs font-medium">
                        Suspended
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-xs font-medium">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {formatDistanceToNow(t.createdAt, { addSuffix: true })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <TutorRowActions
                      tutorId={t.id}
                      isSuspended={t.isSuspended}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
      <div className={`inline-flex items-center gap-2 text-xs uppercase tracking-wide ${tone}`}>
        {icon}
        {label}
      </div>
      <p className="mt-1 text-2xl font-bold text-white tabular-nums">{value}</p>
    </div>
  );
}
