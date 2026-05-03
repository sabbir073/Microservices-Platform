import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ProfileView } from "@/components/user/profile/profile-view";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <ProfileView />;
}
