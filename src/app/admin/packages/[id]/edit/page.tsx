import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasPermission, type UserRole } from "@/lib/rbac";
import { PackageForm } from "../../_components/PackageForm";
import { ArrowLeft, Crown, Star, Sparkles, Package } from "lucide-react";
import Link from "next/link";

interface PageProps {
  params: Promise<{ id: string }>;
}

const tierConfig: Record<string, { icon: typeof Package; color: string }> = {
  FREE: { icon: Package, color: "text-gray-400" },
  BASIC: { icon: Star, color: "text-blue-400" },
  STANDARD: { icon: Sparkles, color: "text-indigo-400" },
  PREMIUM: { icon: Crown, color: "text-purple-400" },
};

export default async function EditPackagePage({ params }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const adminRole = session.user.role as UserRole | undefined;
  if (!hasPermission(adminRole, "packages.edit")) {
    redirect("/admin/packages");
  }

  const { id } = await params;

  const pkg = await prisma.package.findUnique({
    where: { id },
  });

  if (!pkg) {
    notFound();
  }

  const config = tierConfig[pkg.tier] || tierConfig.FREE;
  const Icon = config.icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/packages"
          className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </Link>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-gray-800`}>
            <Icon className={`w-5 h-5 ${config.color}`} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Edit {pkg.name}</h1>
            <p className="text-gray-400">Configure package settings and pricing</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <PackageForm pkg={pkg} />
    </div>
  );
}
