import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission, type UserRole } from "@/lib/rbac";
import { getUserAnalytics } from "@/lib/profile-analytics";

// GET /api/admin/users/[id]/analytics
// Admin-only — returns aggregate post analytics for the target user.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const role = session.user.role as UserRole | undefined;
    if (!hasPermission(role, "users.view")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const data = await getUserAnalytics(id);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Admin user analytics failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
