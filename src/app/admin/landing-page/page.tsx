import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission, type UserRole } from "@/lib/rbac";
import { Layout } from "lucide-react";
import { LandingEditor } from "@/components/admin/landing/landing-editor";
import { getLandingContent } from "@/lib/landing-content-server";

export default async function LandingPageEditor() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const adminRole = session.user.role as UserRole | undefined;
  if (!hasPermission(adminRole, "landing.view")) redirect("/admin");

  const canEdit = hasPermission(adminRole, "landing.edit");
  const content = await getLandingContent();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white inline-flex items-center gap-2">
          <Layout className="w-6 h-6 text-blue-400" />
          Landing Page Editor (CMS)
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Edit every section of the public landing page. Changes go live on next
          page load.
        </p>
      </div>
      <LandingEditor initial={content} canEdit={canEdit} />
    </div>
  );
}
