import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasPermission, type UserRole } from "@/lib/rbac";
import { Gift, FileText } from "lucide-react";
import Link from "next/link";
import { OfferwallsClient } from "@/components/admin/offerwalls/offerwalls-client";

export default async function OfferwallsAdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const adminRole = session.user.role as UserRole | undefined;
  if (!hasPermission(adminRole, "offerwalls.view")) redirect("/admin");

  const canManage = hasPermission(adminRole, "offerwalls.manage");
  const offerwallsRaw = await prisma.offerwallConfig.findMany({
    orderBy: { provider: "asc" },
  });
  const offerwalls = offerwallsRaw.map((o) => ({
    id: o.id,
    provider: o.provider,
    apiKey: o.apiKey,
    secretKey: o.secretKey,
    callbackUrl: o.callbackUrl,
    isActive: o.isActive,
    config:
      o.config && typeof o.config === "object" && !Array.isArray(o.config)
        ? (o.config as Record<string, unknown>)
        : null,
  }));

  const callbackCount = await prisma.offerwallCallback.count();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white inline-flex items-center gap-2">
            <Gift className="w-6 h-6 text-emerald-400" />
            Offerwall Integrations
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage third-party offerwall providers and their postback callbacks.
          </p>
        </div>
        <Link
          href="/admin/offerwall-callbacks"
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700"
        >
          <FileText className="w-4 h-4" />
          Callback Logs ({callbackCount})
        </Link>
      </div>

      <OfferwallsClient initial={offerwalls} canManage={canManage} />
    </div>
  );
}
