import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getEffectiveFeatures } from "@/lib/packages";
import { FeatureLock } from "@/components/user/primitives/feature-lock";
import { AppInstallDetailView } from "@/components/user/tasks/app-install-detail-view";

export default async function AppInstallTaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { enabled } = await getEffectiveFeatures(session.user.id);
  if (!enabled.has("appInstall")) return <FeatureLock title="App Install Tasks" />;

  const { id } = await params;
  return <AppInstallDetailView taskId={id} />;
}
