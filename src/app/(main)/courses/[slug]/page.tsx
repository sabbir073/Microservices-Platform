import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { loadCourseLanding } from "@/lib/course-landing";
import { CourseLanding } from "@/components/user/courses/CourseLanding";

export default async function CourseLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { slug } = await params;
  const data = await loadCourseLanding({ slugOrId: slug, userId: session.user.id });
  if (!data) notFound();

  // If the URL used the legacy /:id form but the course has a slug, redirect
  // to the canonical /:slug URL. (Only when the param is the id, not the slug.)
  if (data.course.slug && data.course.slug !== slug && slug === data.course.id) {
    redirect(`/courses/${data.course.slug}`);
  }

  return <CourseLanding data={data} viewerId={session.user.id} />;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await loadCourseLanding({ slugOrId: slug, userId: null });
  if (!data) return { title: "Course not found" };
  return {
    title: data.course.seoTitle ?? data.course.title,
    description: data.course.seoDescription ?? data.course.subtitle ?? undefined,
    openGraph: {
      title: data.course.seoTitle ?? data.course.title,
      description: data.course.seoDescription ?? data.course.subtitle ?? undefined,
      images: data.course.bannerUrl
        ? [data.course.bannerUrl]
        : data.course.thumbnail
        ? [data.course.thumbnail]
        : undefined,
    },
  };
}
