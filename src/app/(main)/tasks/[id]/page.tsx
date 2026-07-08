import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { taskRunHref } from "@/lib/task-routes";

// Universal task dispatcher: any /tasks/<id> link (earn hub, search, old
// bookmarks) resolves the task's type and forwards to its correct run page.
export default async function TaskDispatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const task = await prisma.task.findUnique({
    where: { id },
    select: { id: true, type: true },
  });
  if (!task) notFound();

  redirect(taskRunHref(task.type, task.id));
}
