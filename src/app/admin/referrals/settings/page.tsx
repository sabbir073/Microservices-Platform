import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasPermission, type UserRole } from "@/lib/rbac";
import { ReferralSettingsForm } from "../_components/ReferralSettingsForm";
import { ArrowLeft, Settings } from "lucide-react";
import Link from "next/link";

export default async function ReferralSettingsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const adminRole = session.user.role as UserRole | undefined;
  if (!hasPermission(adminRole, "referrals.configure")) {
    redirect("/admin/referrals");
  }

  // Fetch existing referral levels
  const referralLevels = await prisma.referralLevel.findMany({
    orderBy: { level: "asc" },
  });

  // If no levels exist, create default structure
  const levels = referralLevels.length > 0
    ? referralLevels
    : Array.from({ length: 10 }, (_, i) => ({
        id: `temp-${i + 1}`,
        level: i + 1,
        commissionRate: 0,
        description: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/referrals"
          className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gray-800">
            <Settings className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Referral Commission Settings</h1>
            <p className="text-gray-400">Configure 10-level MLM commission rates</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <ReferralSettingsForm levels={levels} isNew={referralLevels.length === 0} />
    </div>
  );
}
