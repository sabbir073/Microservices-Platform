import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { hasPermission, type UserRole } from "@/lib/rbac";
import { CourseForm } from "@/components/admin/courses/course-form";

export default async function CreateCoursePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const adminRole = session.user.role as UserRole | undefined;
  if (!hasPermission(adminRole, "courses.manage")) redirect("/admin/courses");

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/courses"
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700"
        >
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Create Course</h1>
          <p className="text-sm text-slate-400">
            Add lessons and publish — students enroll and earn points on completion.
          </p>
        </div>
      </div>
      <CourseForm />
    </div>
  );
}
