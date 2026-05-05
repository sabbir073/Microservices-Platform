import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasPermission, type UserRole } from "@/lib/rbac";
import { SurveyResponsesView } from "@/components/admin/tasks/survey-responses-view";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SurveyResponsesPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const adminRole = session.user.role as UserRole | undefined;
  if (!hasPermission(adminRole, "submissions.view")) redirect("/admin");

  const { id } = await params;

  const task = await prisma.task.findUnique({
    where: { id },
    select: { id: true, title: true, type: true },
  });
  if (!task) notFound();
  if (task.type !== "SURVEY") {
    redirect(`/admin/tasks/${id}`);
  }

  const canExport = hasPermission(adminRole, "analytics.export");

  return (
    <SurveyResponsesView
      taskId={task.id}
      taskTitle={task.title}
      canExport={canExport}
    />
  );
}
