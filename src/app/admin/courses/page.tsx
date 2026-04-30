import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasPermission, type UserRole } from "@/lib/rbac";
import {
  GraduationCap,
  Plus,
  Eye,
  Edit,
  Users,
  CheckCircle,
  FileText,
  Archive,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

interface PageProps {
  searchParams: Promise<{
    page?: string;
    status?: string;
  }>;
}

export default async function CoursesAdminPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const adminRole = session.user.role as UserRole | undefined;
  if (!hasPermission(adminRole, "courses.view")) redirect("/admin");

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1"));
  const pageSize = 20;
  const skip = (page - 1) * pageSize;
  const statusFilter = params.status || "";

  const where = statusFilter ? { status: statusFilter as never } : {};

  const [coursesRaw, total, draftCount, publishedCount, archivedCount, enrollmentTotal] =
    await Promise.all([
      prisma.course.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        include: { _count: { select: { lessons: true, enrollments: true } } },
      }),
      prisma.course.count({ where }),
      prisma.course.count({ where: { status: "DRAFT" } }),
      prisma.course.count({ where: { status: "PUBLISHED" } }),
      prisma.course.count({ where: { status: "ARCHIVED" } }),
      prisma.courseEnrollment.count(),
    ]);

  type CourseRow = (typeof coursesRaw)[0] & {
    _count: { lessons: number; enrollments: number };
  };
  const courses = coursesRaw as CourseRow[];

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canManage = hasPermission(adminRole, "courses.manage");

  const buildHref = (newPage: number) => {
    const sp = new URLSearchParams();
    sp.set("page", String(newPage));
    if (statusFilter) sp.set("status", statusFilter);
    return `/admin/courses?${sp.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white inline-flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-blue-400" />
            Course Management
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Create and publish courses with lessons and enrollment tracking
          </p>
        </div>
        {canManage && (
          <Link
            href="/admin/courses/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Create Course
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat
          icon={<CheckCircle className="w-5 h-5" />}
          tone="emerald"
          value={publishedCount}
          label="Published"
        />
        <Stat
          icon={<FileText className="w-5 h-5" />}
          tone="amber"
          value={draftCount}
          label="Drafts"
        />
        <Stat
          icon={<Archive className="w-5 h-5" />}
          tone="slate"
          value={archivedCount}
          label="Archived"
        />
        <Stat
          icon={<Users className="w-5 h-5" />}
          tone="blue"
          value={enrollmentTotal}
          label="Total Enrollments"
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-800 flex gap-1">
        {[
          { id: "", label: "All" },
          { id: "PUBLISHED", label: "Published" },
          { id: "DRAFT", label: "Drafts" },
          { id: "ARCHIVED", label: "Archived" },
        ].map((t) => (
          <Link
            key={t.id || "all"}
            href={t.id ? `/admin/courses?status=${t.id}` : "/admin/courses"}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${
              statusFilter === t.id || (!statusFilter && !t.id)
                ? "border-blue-500 text-white"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* List */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        {courses.length === 0 ? (
          <div className="p-16 text-center">
            <GraduationCap className="w-12 h-12 mx-auto mb-4 text-slate-600" />
            <h3 className="text-lg font-medium text-white mb-1">
              No courses yet
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              Build a course with lessons and reward students for completion.
            </p>
            {canManage && (
              <Link
                href="/admin/courses/new"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Create First Course
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800/50 border-b border-slate-800">
                <tr>
                  <th className="text-left py-3 px-6 text-sm font-medium text-slate-400">
                    Course
                  </th>
                  <th className="text-left py-3 px-6 text-sm font-medium text-slate-400">
                    Category
                  </th>
                  <th className="text-left py-3 px-6 text-sm font-medium text-slate-400">
                    Difficulty
                  </th>
                  <th className="text-left py-3 px-6 text-sm font-medium text-slate-400">
                    Lessons
                  </th>
                  <th className="text-left py-3 px-6 text-sm font-medium text-slate-400">
                    Enrollments
                  </th>
                  <th className="text-left py-3 px-6 text-sm font-medium text-slate-400">
                    Status
                  </th>
                  <th className="text-left py-3 px-6 text-sm font-medium text-slate-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {courses.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/40">
                    <td className="py-4 px-6">
                      <p className="font-medium text-white truncate max-w-[280px]">
                        {c.title}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatDistanceToNow(c.createdAt, { addSuffix: true })}
                      </p>
                    </td>
                    <td className="py-4 px-6 text-sm text-slate-300">
                      {c.category}
                    </td>
                    <td className="py-4 px-6">
                      <span className="px-2 py-1 rounded-full text-xs bg-slate-800 text-slate-300">
                        {c.difficulty}
                      </span>
                    </td>
                    <td className="py-4 px-6 tabular-nums">
                      {c._count.lessons}
                    </td>
                    <td className="py-4 px-6 tabular-nums">
                      {c._count.enrollments}
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          c.status === "PUBLISHED"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : c.status === "DRAFT"
                            ? "bg-amber-500/10 text-amber-400"
                            : "bg-slate-700/40 text-slate-500"
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-1">
                        <Link
                          href={`/admin/courses/${c.id}`}
                          className="p-1.5 rounded hover:bg-slate-700 text-blue-400"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        {canManage && (
                          <Link
                            href={`/admin/courses/${c.id}/edit`}
                            className="p-1.5 rounded hover:bg-slate-700 text-emerald-400"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {total > pageSize && (
          <div className="p-4 border-t border-slate-800 flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Showing {skip + 1}–{Math.min(skip + pageSize, total)} of {total}
            </p>
            <div className="flex gap-2">
              <Link
                href={page > 1 ? buildHref(page - 1) : "#"}
                className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg ${
                  page > 1
                    ? "bg-slate-800 text-white hover:bg-slate-700"
                    : "bg-slate-800/50 text-slate-600 cursor-not-allowed"
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
                Prev
              </Link>
              <Link
                href={page < totalPages ? buildHref(page + 1) : "#"}
                className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg ${
                  page < totalPages
                    ? "bg-slate-800 text-white hover:bg-slate-700"
                    : "bg-slate-800/50 text-slate-600 cursor-not-allowed"
                }`}
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}
      </div>
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
  tone: "emerald" | "amber" | "slate" | "blue";
  value: number;
  label: string;
}) {
  const cls = {
    emerald: "bg-emerald-500/10 text-emerald-400",
    amber: "bg-amber-500/10 text-amber-400",
    slate: "bg-slate-700/40 text-slate-300",
    blue: "bg-blue-500/10 text-blue-400",
  }[tone];
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${cls}`}>{icon}</div>
        <div>
          <p className="text-2xl font-bold text-white tabular-nums">
            {value.toLocaleString()}
          </p>
          <p className="text-sm text-slate-500">{label}</p>
        </div>
      </div>
    </div>
  );
}
