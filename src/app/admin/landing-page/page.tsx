import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasPermission, type UserRole } from "@/lib/rbac";
import { Layout } from "lucide-react";
import { LandingCmsForm } from "@/components/admin/landing/landing-cms-form";

export default async function LandingPageEditor() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const adminRole = session.user.role as UserRole | undefined;
  if (!hasPermission(adminRole, "landing.view")) redirect("/admin");

  const canEdit = hasPermission(adminRole, "landing.edit");

  const rows = await prisma.systemSetting.findMany({
    where: { category: "landing" },
  });
  const initial: Record<string, unknown> = {};
  for (const r of rows) initial[r.key.replace("lp_", "")] = r.value;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white inline-flex items-center gap-2">
          <Layout className="w-6 h-6 text-blue-400" />
          Landing Page Editor (CMS)
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Edit hero content and the live earnings calculator settings.
        </p>
      </div>
      <LandingCmsForm initial={initial} canEdit={canEdit} />
    </div>
  );
}
