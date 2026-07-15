import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getEffectiveFeatures } from "@/lib/packages";
import { FeatureLock } from "@/components/user/primitives/feature-lock";
import { AppInstallListView } from "@/components/user/tasks/app-install-list-view";

export default async function AppInstallTasksPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { enabled } = await getEffectiveFeatures(session.user.id);
  if (!enabled.has("appInstall")) return <FeatureLock title="App Install Tasks" />;

  return <AppInstallListView />;
}
