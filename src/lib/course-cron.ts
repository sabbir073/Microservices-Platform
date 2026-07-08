import { prisma } from "@/lib/prisma";
import { NotificationType, LiveClassStatus } from "@/generated/prisma";

/**
 * Send an in-app reminder to students who haven't touched their enrolment in
 * 7+ days and aren't finished. Safe to run daily/hourly — de-duped per week.
 */
export async function runCourseReminders(): Promise<{
  candidates: number;
  reminded: number;
}> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const reminderCutoff = sevenDaysAgo;

  const inactive = (await prisma.courseEnrollment.findMany({
    where: {
      completedAt: null,
      updatedAt: { lt: sevenDaysAgo },
      progress: { lt: 100 },
    },
    take: 200,
    orderBy: { updatedAt: "asc" },
    include: { course: { select: { id: true, title: true } } },
  })) as unknown as Array<{
    id: string;
    userId: string;
    courseId: string;
    progress: number;
    course: { id: string; title: string } | null;
  }>;

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

  let reminded = 0;
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
    reminded++;
  }

  return { candidates: inactive.length, reminded };
}

/**
 * 1-hour-before reminders for enrolled students of a live class, plus status
 * transitions UPCOMING → LIVE (at start) and LIVE → ENDED (after duration).
 */
export async function runLiveClassTransitions(): Promise<{
  remindersFired: number;
  started: number;
  ended: number;
}> {
  const now = new Date();
  const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);
  const reminderWindowStart = new Date(now.getTime() + 55 * 60 * 1000);

  const reminderClasses = await prisma.courseLiveClass.findMany({
    where: {
      status: LiveClassStatus.UPCOMING,
      scheduledAt: { gte: reminderWindowStart, lte: inOneHour },
    },
    include: { course: { select: { id: true, title: true } } },
  });

  let remindersFired = 0;
  for (const lc of reminderClasses) {
    const enrolled = await prisma.courseEnrollment.findMany({
      where: { courseId: lc.courseId },
      select: { userId: true },
    });
    if (enrolled.length === 0) continue;
    const already = await prisma.notification.findFirst({
      where: {
        type: NotificationType.COURSE,
        data: { path: ["liveClassId"], equals: lc.id },
      },
      select: { id: true },
    });
    if (already) continue;
    await prisma.notification.createMany({
      data: enrolled.map((e) => ({
        userId: e.userId,
        type: NotificationType.COURSE,
        title: `Live class in 1 hour ⏰`,
        message: `"${lc.title}" for "${lc.course?.title ?? ""}" starts at ${lc.scheduledAt.toUTCString()}.`,
        data: {
          kind: "live-reminder",
          liveClassId: lc.id,
          courseId: lc.courseId,
          meetingUrl: lc.meetingUrl,
        },
      })),
    });
    remindersFired += enrolled.length;
  }

  const startedRaw = await prisma.courseLiveClass.updateMany({
    where: { status: LiveClassStatus.UPCOMING, scheduledAt: { lte: now } },
    data: { status: LiveClassStatus.LIVE },
  });

  const liveOnes = await prisma.courseLiveClass.findMany({
    where: { status: LiveClassStatus.LIVE },
    select: { id: true, scheduledAt: true, durationMinutes: true },
  });
  let ended = 0;
  for (const lc of liveOnes) {
    const endAt = new Date(
      lc.scheduledAt.getTime() + lc.durationMinutes * 60 * 1000
    );
    if (endAt <= now) {
      await prisma.courseLiveClass.update({
        where: { id: lc.id },
        data: { status: LiveClassStatus.ENDED },
      });
      ended += 1;
    }
  }

  return { remindersFired, started: startedRaw.count, ended };
}
