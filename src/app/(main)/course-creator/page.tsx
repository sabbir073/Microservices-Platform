import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CourseCreator } from "@/components/user/courses/course-creator";

export default async function CourseCreatorPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <CourseCreator />;
}
