import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CoursePlayer } from "@/components/user/courses/course-player";

export default async function CoursePlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;
  const course = await prisma.course.findUnique({
    where: { id },
  });
  if (!course) notFound();

  return (
    <CoursePlayer
      course={{
        id: course.id,
        title: course.title,
        description: course.description,
        thumbnail: course.thumbnail ?? undefined,
        difficulty: course.difficulty,
        duration: course.totalDuration,
      }}
      userId={session.user.id}
    />
  );
}
