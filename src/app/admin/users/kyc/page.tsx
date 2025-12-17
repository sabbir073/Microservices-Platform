import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  ArrowLeft,
  FileCheck,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  User,
  Calendar,
  FileImage,
} from "lucide-react";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { hasPermission, type UserRole } from "@/lib/rbac";

interface PageProps {
  searchParams: Promise<{
    status?: string;
  }>;
}

export default async function KYCQueuePage({ searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const adminRole = session.user.role as UserRole | undefined;
  if (!hasPermission(adminRole, "kyc.view")) {
    redirect("/admin");
  }

  const params = await searchParams;
  const statusFilter = params.status || "PENDING";

  // Fetch KYC documents with user info
  const kycDocumentsRaw = await prisma.kYCDocument.findMany({
    where: {
      status: statusFilter as "NOT_SUBMITTED" | "PENDING" | "APPROVED" | "REJECTED",
    },
    orderBy: { createdAt: "asc" },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
          createdAt: true,
          kycStatus: true,
          packageTier: true,
          level: true,
        },
      },
    },
    take: 50,
  });

  // Type assertion needed due to Prisma Accelerate extension type inference issues
  type KYCDocWithUser = typeof kycDocumentsRaw[0] & {
    user: {
      id: string;
      name: string | null;
      email: string;
      avatar: string | null;
      createdAt: Date;
      kycStatus: string;
      packageTier: string;
      level: number;
    };
  };
  const kycDocuments = kycDocumentsRaw as KYCDocWithUser[];

  // Fetch stats
  const [pendingCount, approvedCount, rejectedCount] = await Promise.all([
    prisma.kYCDocument.count({ where: { status: "PENDING" } }),
    prisma.kYCDocument.count({ where: { status: "APPROVED" } }),
    prisma.kYCDocument.count({ where: { status: "REJECTED" } }),
  ]);

  const tabs = [
    { id: "PENDING", label: "Pending", count: pendingCount, color: "amber" },
    { id: "APPROVED", label: "Approved", count: approvedCount, color: "emerald" },
    { id: "REJECTED", label: "Rejected", count: rejectedCount, color: "red" },
  ];

  const canApprove = hasPermission(adminRole, "kyc.approve");
  const canReject = hasPermission(adminRole, "kyc.reject");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/users"
          className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">KYC Verification Queue</h1>
          <p className="text-gray-400">
            Review and verify user identity documents
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <Clock className="w-4 h-4 text-amber-400" />
          <span className="text-amber-400 font-medium">{pendingCount} Pending</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-800">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={`/admin/users/kyc?status=${tab.id}`}
            className={`pb-4 px-2 text-sm font-medium border-b-2 transition-colors ${
              statusFilter === tab.id
                ? `border-${tab.color}-500 text-white`
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            {tab.label}
            <span className={`ml-2 px-1.5 py-0.5 text-xs rounded ${
              statusFilter === tab.id
                ? `bg-${tab.color}-500/10 text-${tab.color}-400`
                : "bg-gray-800 text-gray-500"
            }`}>
              {tab.count}
            </span>
          </Link>
        ))}
      </div>

      {/* KYC Queue */}
      {kycDocuments.length > 0 ? (
        <div className="space-y-4">
          {kycDocuments.map((doc) => (
            <div
              key={doc.id}
              className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden"
            >
              <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <Link href={`/admin/users/${doc.user.id}`}>
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-medium">
                        {doc.user.name?.charAt(0) || doc.user.email?.charAt(0) || "U"}
                      </div>
                    </Link>
                    <div>
                      <Link
                        href={`/admin/users/${doc.user.id}`}
                        className="text-lg font-medium text-white hover:text-indigo-400 transition-colors"
                      >
                        {doc.user.name || "Unnamed"}
                      </Link>
                      <p className="text-sm text-gray-500">{doc.user.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-400">Level {doc.user.level}</span>
                        <span className="text-gray-600">|</span>
                        <span className={`text-xs ${
                          doc.user.packageTier === "PREMIUM" ? "text-purple-400" :
                          doc.user.packageTier === "STANDARD" ? "text-indigo-400" :
                          doc.user.packageTier === "BASIC" ? "text-blue-400" :
                          "text-gray-400"
                        }`}>{doc.user.packageTier}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-400">Submitted</p>
                    <p className="text-sm text-white">
                      {formatDistanceToNow(doc.createdAt, { addSuffix: true })}
                    </p>
                  </div>
                </div>

                {/* Document Info */}
                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <FileImage className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-400">Document Type:</span>
                      <span className="text-sm text-white">{doc.documentType}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-400">Member Since:</span>
                      <span className="text-sm text-white">
                        {format(doc.user.createdAt, "MMM d, yyyy")}
                      </span>
                    </div>
                  </div>

                  {/* Document Preview */}
                  <div className="flex items-center gap-4">
                    <a
                      href={doc.documentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      <Eye className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-white">View Document</span>
                    </a>
                  </div>
                </div>

                {/* Review Status */}
                {doc.status === "APPROVED" && (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                      <span className="text-emerald-400 font-medium">Approved</span>
                    </div>
                    {doc.reviewedAt && (
                      <p className="text-sm text-gray-400 mt-1">
                        Reviewed on {format(doc.reviewedAt, "MMM d, yyyy HH:mm")}
                      </p>
                    )}
                  </div>
                )}

                {doc.status === "REJECTED" && (
                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      <XCircle className="w-5 h-5 text-red-400" />
                      <span className="text-red-400 font-medium">Rejected</span>
                    </div>
                    {doc.rejectionReason && (
                      <p className="text-sm text-gray-400 mt-1">
                        Reason: {doc.rejectionReason}
                      </p>
                    )}
                    {doc.reviewedAt && (
                      <p className="text-sm text-gray-400 mt-1">
                        Reviewed on {format(doc.reviewedAt, "MMM d, yyyy HH:mm")}
                      </p>
                    )}
                  </div>
                )}

                {/* Actions for Pending */}
                {doc.status === "PENDING" && (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-4 border-t border-gray-800">
                    <div className="flex-1">
                      <p className="text-sm text-gray-400 mb-2">Verification Checklist:</p>
                      <div className="flex flex-wrap gap-3">
                        <label className="flex items-center gap-2 text-sm text-gray-400">
                          <input type="checkbox" className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-emerald-500" />
                          Name matches ID
                        </label>
                        <label className="flex items-center gap-2 text-sm text-gray-400">
                          <input type="checkbox" className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-emerald-500" />
                          Photo is clear
                        </label>
                        <label className="flex items-center gap-2 text-sm text-gray-400">
                          <input type="checkbox" className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-emerald-500" />
                          ID not expired
                        </label>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {canApprove && (
                        <button className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors">
                          <CheckCircle className="w-4 h-4" />
                          Approve
                        </button>
                      )}
                      {canReject && (
                        <button className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition-colors">
                          <XCircle className="w-4 h-4" />
                          Reject
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-16 text-center">
          <FileCheck className="w-12 h-12 mx-auto mb-4 text-gray-600" />
          <h3 className="text-lg font-medium text-white mb-2">
            {statusFilter === "PENDING" ? "No pending verifications" : `No ${statusFilter.toLowerCase()} documents`}
          </h3>
          <p className="text-gray-400">
            {statusFilter === "PENDING"
              ? "All KYC submissions have been reviewed!"
              : `There are no ${statusFilter.toLowerCase()} KYC documents to show.`}
          </p>
        </div>
      )}
    </div>
  );
}
