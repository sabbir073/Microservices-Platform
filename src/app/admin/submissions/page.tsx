import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  ClipboardCheck,
  Search,
  Filter,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  ChevronLeft,
  ChevronRight,
  Video,
  FileText,
  HelpCircle,
  ClipboardList,
  Share2,
  Globe,
  Gift,
  Sparkles,
  Star,
  ExternalLink,
  Image as ImageIcon,
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
    taskId?: string;
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

export default async function AdminSubmissionsPage({ searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const adminRole = session.user.role as UserRole | undefined;
  if (!hasPermission(adminRole, "submissions.view")) {
    redirect("/admin");
  }

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1"));
  const pageSize = 20;
  const skip = (page - 1) * pageSize;

  // Build where clause based on filters
  const where: Prisma.TaskSubmissionWhereInput = {};

  if (params.status && params.status !== "all") {
    where.status = params.status as Prisma.EnumSubmissionStatusFilter["equals"];
  }

  if (params.type && params.type !== "all") {
    where.task = {
      type: params.type as Prisma.EnumTaskTypeFilter["equals"],
    };
  }

  if (params.taskId) {
    where.taskId = params.taskId;
  }

  // Fetch submissions and stats
  const [submissionsRaw, totalCount, pendingCount, approvedCount, rejectedCount] = await Promise.all([
    prisma.taskSubmission.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            level: true,
          },
        },
        task: {
          select: {
            id: true,
            title: true,
            type: true,
            pointsReward: true,
            xpReward: true,
          },
        },
      },
    }),
    prisma.taskSubmission.count({ where }),
    prisma.taskSubmission.count({ where: { status: "PENDING" } }),
    prisma.taskSubmission.count({ where: { status: "APPROVED" } }),
    prisma.taskSubmission.count({ where: { status: "REJECTED" } }),
  ]);

  // Type assertion for Prisma Accelerate
  type SubmissionWithRelations = typeof submissionsRaw[0] & {
    user: {
      id: string;
      name: string | null;
      email: string;
      avatar: string | null;
      level: number;
    };
    task: {
      id: string;
      title: string;
      type: string;
      pointsReward: number;
      xpReward: number;
    };
  };
  const submissions = submissionsRaw as SubmissionWithRelations[];

  const totalPages = Math.ceil(totalCount / pageSize);

  const buildQueryString = (newPage: number) => {
    const queryParams = new URLSearchParams();
    queryParams.set("page", newPage.toString());
    if (params.status) queryParams.set("status", params.status);
    if (params.type) queryParams.set("type", params.type);
    if (params.taskId) queryParams.set("taskId", params.taskId);
    return queryParams.toString();
  };

  const canApprove = hasPermission(adminRole, "submissions.approve");
  const canReject = hasPermission(adminRole, "submissions.reject");

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Submission Review</h1>
          <p className="text-gray-400 mt-1">
            Review and approve task submissions
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <Clock className="w-4 h-4 text-amber-400" />
          <span className="text-amber-400 font-medium">{pendingCount} Pending</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Link
          href="/admin/submissions"
          className="bg-gray-900 rounded-xl border border-gray-800 p-4 hover:border-indigo-500/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
              <ClipboardCheck className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{totalCount}</p>
              <p className="text-sm text-gray-500">Total</p>
            </div>
          </div>
        </Link>
        <Link
          href="/admin/submissions?status=PENDING"
          className={`bg-gray-900 rounded-xl border p-4 transition-colors ${
            params.status === "PENDING" ? "border-amber-500/50" : "border-gray-800 hover:border-amber-500/50"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{pendingCount}</p>
              <p className="text-sm text-gray-500">Pending</p>
            </div>
          </div>
        </Link>
        <Link
          href="/admin/submissions?status=APPROVED"
          className={`bg-gray-900 rounded-xl border p-4 transition-colors ${
            params.status === "APPROVED" ? "border-emerald-500/50" : "border-gray-800 hover:border-emerald-500/50"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{approvedCount}</p>
              <p className="text-sm text-gray-500">Approved</p>
            </div>
          </div>
        </Link>
        <Link
          href="/admin/submissions?status=REJECTED"
          className={`bg-gray-900 rounded-xl border p-4 transition-colors ${
            params.status === "REJECTED" ? "border-red-500/50" : "border-gray-800 hover:border-red-500/50"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/10 rounded-lg">
              <XCircle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{rejectedCount}</p>
              <p className="text-sm text-gray-500">Rejected</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Filters */}
      <form className="flex flex-col sm:flex-row gap-4">
        <div className="flex gap-2 flex-wrap flex-1">
          <select
            name="status"
            defaultValue={params.status || "all"}
            className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-500"
          >
            <option value="all">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="AUTO_APPROVED">Auto-Approved</option>
          </select>
          <select
            name="type"
            defaultValue={params.type || "all"}
            className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-500"
          >
            <option value="all">All Task Types</option>
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

      {/* Submissions List */}
      {submissions.length > 0 ? (
        <div className="space-y-4">
          {submissions.map((submission) => {
            const Icon = taskTypeIcons[submission.task.type] || Sparkles;
            const colorClass = taskTypeColors[submission.task.type] || "text-gray-400 bg-gray-500/10";

            return (
              <div
                key={submission.id}
                className="bg-gray-900 rounded-xl border border-gray-800 p-5 hover:border-gray-700 transition-colors"
              >
                <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                  {/* User Info */}
                  <div className="flex items-start gap-3 flex-shrink-0 w-full lg:w-64">
                    <Link href={`/admin/users/${submission.user.id}`}>
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-medium">
                        {submission.user.name?.charAt(0) || submission.user.email?.charAt(0) || "U"}
                      </div>
                    </Link>
                    <div>
                      <Link
                        href={`/admin/users/${submission.user.id}`}
                        className="text-sm font-medium text-white hover:text-indigo-400 transition-colors"
                      >
                        {submission.user.name || "Unnamed"}
                      </Link>
                      <p className="text-xs text-gray-500">{submission.user.email}</p>
                      <p className="text-xs text-gray-600">Level {submission.user.level}</p>
                    </div>
                  </div>

                  {/* Task & Submission Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`p-1.5 rounded-lg ${colorClass}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <Link
                        href={`/admin/tasks/${submission.task.id}`}
                        className="text-sm font-medium text-white hover:text-indigo-400 transition-colors truncate"
                      >
                        {submission.task.title}
                      </Link>
                    </div>

                    {/* Proof */}
                    {submission.proof && (
                      <div className="mb-3">
                        <p className="text-xs text-gray-500 mb-1">Proof submitted:</p>
                        <p className="text-sm text-gray-300 bg-gray-800/50 rounded-lg p-3">
                          {submission.proof}
                        </p>
                      </div>
                    )}

                    {/* Proof Images */}
                    {submission.proofImages && submission.proofImages.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs text-gray-500 mb-1">Images:</p>
                        <div className="flex gap-2 flex-wrap">
                          {submission.proofImages.map((image, idx) => (
                            <a
                              key={idx}
                              href={image}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 px-2 py-1 bg-gray-800 rounded text-xs text-gray-400 hover:text-white transition-colors"
                            >
                              <ImageIcon className="w-3 h-3" />
                              Image {idx + 1}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Rewards */}
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-indigo-400" />
                        <span className="text-white">{submission.task.pointsReward.toLocaleString()}</span>
                        <span className="text-gray-500">pts</span>
                      </div>
                      {submission.task.xpReward > 0 && (
                        <div className="flex items-center gap-1">
                          <Sparkles className="w-4 h-4 text-purple-400" />
                          <span className="text-white">{submission.task.xpReward}</span>
                          <span className="text-gray-500">XP</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status & Actions */}
                  <div className="flex flex-col items-end gap-3 flex-shrink-0">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      submission.status === "APPROVED" || submission.status === "AUTO_APPROVED"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : submission.status === "PENDING"
                        ? "bg-amber-500/10 text-amber-400"
                        : "bg-red-500/10 text-red-400"
                    }`}>
                      {submission.status.replace(/_/g, " ")}
                    </span>

                    <p className="text-xs text-gray-500">
                      {formatDistanceToNow(submission.createdAt, { addSuffix: true })}
                    </p>

                    {submission.status === "PENDING" && (
                      <div className="flex gap-2">
                        {canApprove && (
                          <button className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-500 text-white text-sm rounded-lg hover:bg-emerald-600 transition-colors">
                            <CheckCircle className="w-4 h-4" />
                            Approve
                          </button>
                        )}
                        {canReject && (
                          <button className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/30 text-sm rounded-lg hover:bg-red-500/20 transition-colors">
                            <XCircle className="w-4 h-4" />
                            Reject
                          </button>
                        )}
                      </div>
                    )}

                    {submission.status === "REJECTED" && submission.rejectionReason && (
                      <p className="text-xs text-red-400 max-w-xs text-right">
                        Reason: {submission.rejectionReason}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-16 text-center">
          <ClipboardCheck className="w-12 h-12 mx-auto mb-4 text-gray-600" />
          <h3 className="text-lg font-medium text-white mb-2">No submissions found</h3>
          <p className="text-gray-400">
            {params.status === "PENDING"
              ? "All submissions have been reviewed!"
              : "Submissions will appear here once users complete tasks"}
          </p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {skip + 1} - {Math.min(skip + pageSize, totalCount)} of {totalCount} submissions
          </p>
          <div className="flex gap-2">
            <Link
              href={page > 1 ? `/admin/submissions?${buildQueryString(page - 1)}` : "#"}
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
                    href={`/admin/submissions?${buildQueryString(pageNum)}`}
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
              href={page < totalPages ? `/admin/submissions?${buildQueryString(page + 1)}` : "#"}
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
