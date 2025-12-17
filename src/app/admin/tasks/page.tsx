import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  ListTodo,
  Search,
  Filter,
  Plus,
  Eye,
  Edit,
  Pause,
  Play,
  Trash2,
  Video,
  FileText,
  HelpCircle,
  ClipboardList,
  Share2,
  Globe,
  Gift,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle,
  XCircle,
  Star,
} from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import { hasPermission, type UserRole } from "@/lib/rbac";
import { Prisma } from "@/generated/prisma/client";

interface PageProps {
  searchParams: Promise<{
    page?: string;
    status?: string;
    type?: string;
    search?: string;
  }>;
}

// Icon mapping for task types
const taskTypeIcons: Record<string, typeof Video> = {
  VIDEO: Video,
  ARTICLE: FileText,
  QUIZ: HelpCircle,
  SURVEY: ClipboardList,
  SOCIAL: Share2,
  PROXY: Globe,
  OFFERWALL: Gift,
  CUSTOM: Sparkles,
};

const taskTypeColors: Record<string, string> = {
  VIDEO: "text-red-400 bg-red-500/10",
  ARTICLE: "text-blue-400 bg-blue-500/10",
  QUIZ: "text-amber-400 bg-amber-500/10",
  SURVEY: "text-purple-400 bg-purple-500/10",
  SOCIAL: "text-pink-400 bg-pink-500/10",
  PROXY: "text-cyan-400 bg-cyan-500/10",
  OFFERWALL: "text-emerald-400 bg-emerald-500/10",
  CUSTOM: "text-indigo-400 bg-indigo-500/10",
};

export default async function AdminTasksPage({ searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const adminRole = session.user.role as UserRole | undefined;
  if (!hasPermission(adminRole, "tasks.view")) {
    redirect("/admin");
  }

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1"));
  const pageSize = 20;
  const skip = (page - 1) * pageSize;

  // Build where clause based on filters
  const where: Prisma.TaskWhereInput = {};

  if (params.status && params.status !== "all") {
    where.status = params.status as Prisma.EnumTaskStatusFilter["equals"];
  }

  if (params.type && params.type !== "all") {
    where.type = params.type as Prisma.EnumTaskTypeFilter["equals"];
  }

  if (params.search) {
    where.OR = [
      { title: { contains: params.search, mode: "insensitive" } },
      { description: { contains: params.search, mode: "insensitive" } },
    ];
  }

  // Fetch tasks and stats
  const [tasksRaw, totalCount, activeCount, pausedCount, pendingSubmissions] = await Promise.all([
    prisma.task.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        _count: {
          select: {
            submissions: true,
          },
        },
      },
    }),
    prisma.task.count({ where }),
    prisma.task.count({ where: { status: "ACTIVE" } }),
    prisma.task.count({ where: { status: "PAUSED" } }),
    prisma.taskSubmission.count({ where: { status: "PENDING" } }),
  ]);

  // Type assertion for Prisma Accelerate
  type TaskWithCount = typeof tasksRaw[0] & {
    _count: { submissions: number };
  };
  const tasks = tasksRaw as TaskWithCount[];

  const totalPages = Math.ceil(totalCount / pageSize);

  const buildQueryString = (newPage: number) => {
    const queryParams = new URLSearchParams();
    queryParams.set("page", newPage.toString());
    if (params.status) queryParams.set("status", params.status);
    if (params.type) queryParams.set("type", params.type);
    if (params.search) queryParams.set("search", params.search);
    return queryParams.toString();
  };

  const canCreate = hasPermission(adminRole, "tasks.create");
  const canEdit = hasPermission(adminRole, "tasks.edit");
  const canDelete = hasPermission(adminRole, "tasks.delete");

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Task Management</h1>
          <p className="text-gray-400 mt-1">
            Create and manage earning tasks
          </p>
        </div>
        <div className="flex gap-3">
          {pendingSubmissions > 0 && (
            <Link
              href="/admin/submissions"
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg hover:bg-amber-500/20 transition-colors"
            >
              <Clock className="w-4 h-4" />
              Review Queue ({pendingSubmissions})
            </Link>
          )}
          {canCreate && (
            <Link
              href="/admin/tasks/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Task
            </Link>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Link
          href="/admin/tasks"
          className="bg-gray-900 rounded-xl border border-gray-800 p-4 hover:border-indigo-500/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
              <ListTodo className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{totalCount}</p>
              <p className="text-sm text-gray-500">Total Tasks</p>
            </div>
          </div>
        </Link>
        <Link
          href="/admin/tasks?status=ACTIVE"
          className={`bg-gray-900 rounded-xl border p-4 transition-colors ${
            params.status === "ACTIVE" ? "border-emerald-500/50" : "border-gray-800 hover:border-emerald-500/50"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{activeCount}</p>
              <p className="text-sm text-gray-500">Active</p>
            </div>
          </div>
        </Link>
        <Link
          href="/admin/tasks?status=PAUSED"
          className={`bg-gray-900 rounded-xl border p-4 transition-colors ${
            params.status === "PAUSED" ? "border-amber-500/50" : "border-gray-800 hover:border-amber-500/50"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <Pause className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{pausedCount}</p>
              <p className="text-sm text-gray-500">Paused</p>
            </div>
          </div>
        </Link>
        <Link
          href="/admin/submissions?status=PENDING"
          className="bg-gray-900 rounded-xl border border-gray-800 p-4 hover:border-amber-500/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{pendingSubmissions}</p>
              <p className="text-sm text-gray-500">Pending Reviews</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Filters */}
      <form className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="search"
            name="search"
            defaultValue={params.search}
            placeholder="Search tasks by title, description..."
            className="w-full pl-10 pr-4 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-red-500"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <select
            name="status"
            defaultValue={params.status || "all"}
            className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-500"
          >
            <option value="all">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="PAUSED">Paused</option>
            <option value="COMPLETED">Completed</option>
            <option value="EXPIRED">Expired</option>
          </select>
          <select
            name="type"
            defaultValue={params.type || "all"}
            className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-500"
          >
            <option value="all">All Types</option>
            <option value="VIDEO">Video</option>
            <option value="ARTICLE">Article</option>
            <option value="QUIZ">Quiz</option>
            <option value="SURVEY">Survey</option>
            <option value="SOCIAL">Social</option>
            <option value="PROXY">Proxy</option>
            <option value="OFFERWALL">Offerwall</option>
            <option value="CUSTOM">Custom</option>
          </select>
          <button
            type="submit"
            className="p-2.5 bg-red-500 rounded-lg text-white hover:bg-red-600 transition-colors"
          >
            <Filter className="w-5 h-5" />
          </button>
        </div>
      </form>

      {/* Tasks Grid */}
      {tasks.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tasks.map((task) => {
            const Icon = taskTypeIcons[task.type] || Sparkles;
            const colorClass = taskTypeColors[task.type] || "text-gray-400 bg-gray-500/10";

            return (
              <div
                key={task.id}
                className="bg-gray-900 rounded-xl border border-gray-800 p-5 hover:border-gray-700 transition-colors"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${colorClass}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${colorClass}`}>
                        {task.type}
                      </span>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    task.status === "ACTIVE"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : task.status === "PAUSED"
                      ? "bg-amber-500/10 text-amber-400"
                      : task.status === "COMPLETED"
                      ? "bg-blue-500/10 text-blue-400"
                      : "bg-red-500/10 text-red-400"
                  }`}>
                    {task.status}
                  </span>
                </div>

                {/* Title & Description */}
                <Link href={`/admin/tasks/${task.id}`} className="group">
                  <h3 className="text-lg font-semibold text-white group-hover:text-indigo-400 transition-colors line-clamp-1">
                    {task.title}
                  </h3>
                </Link>
                <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                  {task.description}
                </p>

                {/* Rewards */}
                <div className="flex items-center gap-4 mt-4 text-sm">
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-indigo-400" />
                    <span className="text-white">{task.pointsReward.toLocaleString()}</span>
                    <span className="text-gray-500">pts</span>
                  </div>
                  {task.xpReward > 0 && (
                    <div className="flex items-center gap-1">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      <span className="text-white">{task.xpReward}</span>
                      <span className="text-gray-500">XP</span>
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-800 text-sm text-gray-400">
                  <span>{task._count.submissions} submissions</span>
                  <span>{task.completedCount} completed</span>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between mt-4">
                  <span className="text-xs text-gray-500">
                    Created {formatDistanceToNow(task.createdAt, { addSuffix: true })}
                  </span>
                  <div className="flex items-center gap-1">
                    <Link
                      href={`/admin/tasks/${task.id}`}
                      className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                      title="View"
                    >
                      <Eye className="w-4 h-4" />
                    </Link>
                    {canEdit && (
                      <>
                        <Link
                          href={`/admin/tasks/${task.id}/edit`}
                          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                        {task.status === "ACTIVE" ? (
                          <button
                            className="p-1.5 text-gray-400 hover:text-amber-400 hover:bg-gray-800 rounded-lg transition-colors"
                            title="Pause"
                          >
                            <Pause className="w-4 h-4" />
                          </button>
                        ) : task.status === "PAUSED" ? (
                          <button
                            className="p-1.5 text-gray-400 hover:text-emerald-400 hover:bg-gray-800 rounded-lg transition-colors"
                            title="Resume"
                          >
                            <Play className="w-4 h-4" />
                          </button>
                        ) : null}
                      </>
                    )}
                    {canDelete && (
                      <button
                        className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-16 text-center">
          <ListTodo className="w-12 h-12 mx-auto mb-4 text-gray-600" />
          <h3 className="text-lg font-medium text-white mb-2">No tasks found</h3>
          <p className="text-gray-400">
            {params.search || params.status || params.type
              ? "Try adjusting your filters"
              : "Create your first task to get started"}
          </p>
          {canCreate && !params.search && !params.status && !params.type && (
            <Link
              href="/admin/tasks/new"
              className="inline-flex items-center gap-2 px-4 py-2 mt-4 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Task
            </Link>
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {skip + 1} - {Math.min(skip + pageSize, totalCount)} of {totalCount} tasks
          </p>
          <div className="flex gap-2">
            <Link
              href={page > 1 ? `/admin/tasks?${buildQueryString(page - 1)}` : "#"}
              className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                page > 1
                  ? "bg-gray-800 text-white hover:bg-gray-700"
                  : "bg-gray-800/50 text-gray-600 cursor-not-allowed"
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Link>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }

                return (
                  <Link
                    key={pageNum}
                    href={`/admin/tasks?${buildQueryString(pageNum)}`}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      pageNum === page
                        ? "bg-red-500 text-white"
                        : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
                    }`}
                  >
                    {pageNum}
                  </Link>
                );
              })}
            </div>
            <Link
              href={page < totalPages ? `/admin/tasks?${buildQueryString(page + 1)}` : "#"}
              className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                page < totalPages
                  ? "bg-gray-800 text-white hover:bg-gray-700"
                  : "bg-gray-800/50 text-gray-600 cursor-not-allowed"
              }`}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
