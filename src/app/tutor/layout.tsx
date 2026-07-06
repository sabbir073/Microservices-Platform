import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasPermission, type UserRole } from "@/lib/rbac";
import { TutorShell } from "@/components/tutor/TutorShell";

export default async function TutorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const role = session.user.role as UserRole | undefined;
  if (!hasPermission(role, "tutor.dashboard")) {
    redirect("/profile/become-tutor");
  }

  return (
    <TutorShell
      user={{
        id: session.user.id ?? "",
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        avatar: (session.user as { avatar?: string | null })?.avatar ?? null,
      }}
    >
      {children}
    </TutorShell>
  );
}
