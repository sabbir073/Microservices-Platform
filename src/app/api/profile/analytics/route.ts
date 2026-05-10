import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserAnalytics } from "@/lib/profile-analytics";

// GET /api/profile/analytics
// Returns aggregate post analytics for the logged-in user.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const data = await getUserAnalytics(session.user.id);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Profile analytics failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
