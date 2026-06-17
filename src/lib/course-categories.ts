import { prisma } from "@/lib/prisma";
import type { CategoryOption } from "@/components/admin/courses/course-builder/types";

/** Load active CourseCategory rows (with subcategories) shaped for the
 *  CourseBuilder's category dropdown. Used by both admin + tutor pages. */
export async function loadCategoryOptions(): Promise<CategoryOption[]> {
  const rows = await prisma.courseCategory.findMany({
    where: { isActive: true },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    include: {
      subcategories: {
        where: { isActive: true },
        orderBy: [{ order: "asc" }, { name: "asc" }],
      },
    },
  });
  return (rows as unknown as Array<{
    id: string;
    slug: string;
    name: string;
    subcategories: Array<{ id: string; slug: string; name: string }>;
  }>).map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    subcategories: r.subcategories.map((s) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
    })),
  }));
}
