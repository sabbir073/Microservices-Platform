import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { NotificationType } from "@/generated/prisma";

// POST /api/cron/course-reminders
// Sends an in-app reminder to students who haven't touched their enrolment in
// 7+ days and aren't already finished. Safe to hit hourly — a row's `updatedAt`
// only changes on real progress so we won't spam.
//
// Auth: hits a cron secret in `CRON_SECRET` (env). For now we'll accept the
// `Authorization: Bearer <secret>` header OR an admin session. Wire to your
// cron provider (Vercel cron, GitHub Actions, etc.).
export async function POST(req: NextRequest) {
  try {
    if (!authorized(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const reminderCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Inactive enrolments: not completed, last touched > 7d ago.
    // Prisma Accelerate collapses include payloads — assert the shape so we
    // can read `e.course.title` below.
    const inactive = (await prisma.courseEnrollment.findMany({
      where: {
        completedAt: null,
        updatedAt: { lt: sevenDaysAgo },
        progress: { lt: 100 },
      },
      take: 200, // safety cap per run
      orderBy: { updatedAt: "asc" },
      include: { course: { select: { id: true, title: true } } },
    })) as unknown as Array<{
      id: string;
      userId: string;
      courseId: string;
      progress: number;
      course: { id: string; title: string } | null;
    }>;

    // De-dupe: skip users who already got a course-reminder notification this week.
    const recentNotifs = await prisma.notification.findMany({
      where: {
        type: NotificationType.COURSE,
        createdAt: { gt: reminderCutoff },
        title: { contains: "Pick up where you left off" },
      },
      select: { userId: true, data: true },
    });
    type NotifDataShape = { courseId?: string };
    const recentSet = new Set(
      recentNotifs.map((n) => {
        const data = n.data as NotifDataShape | null;
        return `${n.userId}_${data?.courseId ?? ""}`;
      })
    );

    const fired: Array<{ enrollmentId: string; userId: string }> = [];
    for (const e of inactive) {
      const key = `${e.userId}_${e.courseId}`;
      if (recentSet.has(key)) continue;
      await prisma.notification.create({
        data: {
          userId: e.userId,
          type: NotificationType.COURSE,
          title: "Pick up where you left off 📚",
          message: `Your course "${e.course?.title ?? "(course)"}" is waiting. You're ${e.progress}% in — let's finish strong.`,
          data: {
            courseId: e.courseId,
            enrollmentId: e.id,
            kind: "inactivity-reminder",
          },
        },
      });
      fired.push({ enrollmentId: e.id, userId: e.userId });
    }

    return NextResponse.json({
      candidates: inactive.length,
      reminded: fired.length,
    });
  } catch (error) {
    console.error("Course reminders cron failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}
