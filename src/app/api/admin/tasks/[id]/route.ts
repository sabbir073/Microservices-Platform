import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, type UserRole } from "@/lib/rbac";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminRole = session.user.role as UserRole | undefined;
    if (!hasPermission(adminRole, "tasks.view")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        _count: {
          select: { submissions: true },
        },
        submissions: {
          orderBy: { createdAt: "desc" },
          take: 10,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({ task });
  } catch (error) {
    console.error("Error fetching task:", error);
    return NextResponse.json(
      { error: "Failed to fetch task" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminRole = session.user.role as UserRole | undefined;
    if (!hasPermission(adminRole, "tasks.edit")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    // Check if task exists
    const existingTask = await prisma.task.findUnique({
      where: { id },
    });

    if (!existingTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const {
      title,
      description,
      instructions,
      type,
      status,
      pointsReward,
      xpReward,
      dailyLimit,
      totalLimit,
      minLevel,
      requiredPackage,
      countries,
      contentUrl,
      thumbnailUrl,
      duration,
      questions,
      socialPlatform,
      socialAction,
      socialUrl,
      proxyInstructions,
      startsAt,
      expiresAt,
      cooldownMinutes,
      autoApprove,
    } = body;

    // Update the task
    const task = await prisma.task.update({
      where: { id },
      data: {
        title,
        description,
        instructions: instructions || null,
        type,
        status: status || existingTask.status,
        pointsReward: parseInt(pointsReward.toString()),
        xpReward: parseInt(xpReward?.toString() || "0"),
        dailyLimit: dailyLimit ? parseInt(dailyLimit.toString()) : null,
        totalLimit: totalLimit ? parseInt(totalLimit.toString()) : null,
        minLevel: parseInt(minLevel?.toString() || "1"),
        requiredPackage: requiredPackage || "FREE",
        countries: countries || [],
        contentUrl: contentUrl || null,
        thumbnailUrl: thumbnailUrl || null,
        duration: duration ? parseInt(duration.toString()) : null,
        questions: questions || null,
        socialPlatform: socialPlatform || null,
        socialAction: socialAction || null,
        socialUrl: socialUrl || null,
        proxyInstructions: proxyInstructions || null,
        startsAt: startsAt ? new Date(startsAt) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        cooldownMinutes: parseInt(cooldownMinutes?.toString() || "0"),
        autoApprove: autoApprove || false,
      },
    });

    return NextResponse.json({ success: true, task });
  } catch (error) {
    console.error("Error updating task:", error);
    return NextResponse.json(
      { error: "Failed to update task" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminRole = session.user.role as UserRole | undefined;
    if (!hasPermission(adminRole, "tasks.delete")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Check if task exists
    const existingTask = await prisma.task.findUnique({
      where: { id },
    });

    if (!existingTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Delete the task
    await prisma.task.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Task deleted successfully" });
  } catch (error) {
    console.error("Error deleting task:", error);
    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 }
    );
  }
}

// PATCH for status changes (pause/resume)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminRole = session.user.role as UserRole | undefined;
    if (!hasPermission(adminRole, "tasks.edit")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    // Check if task exists
    const existingTask = await prisma.task.findUnique({
      where: { id },
    });

    if (!existingTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    let newStatus: "ACTIVE" | "PAUSED" | "COMPLETED" | "EXPIRED";

    switch (action) {
      case "pause":
        newStatus = "PAUSED";
        break;
      case "resume":
        newStatus = "ACTIVE";
        break;
      case "complete":
        newStatus = "COMPLETED";
        break;
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const task = await prisma.task.update({
      where: { id },
      data: { status: newStatus },
    });

    return NextResponse.json({ success: true, task });
  } catch (error) {
    console.error("Error updating task status:", error);
    return NextResponse.json(
      { error: "Failed to update task status" },
      { status: 500 }
    );
  }
}
