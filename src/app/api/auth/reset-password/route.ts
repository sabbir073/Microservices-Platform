import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resetPassword } from "@/lib/auth/services";
import { enforceRateLimit } from "@/lib/rate-limit";
import { validatePassword } from "@/lib/password-policy";

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  // Length + character classes come from the admin Security policy and are
  // checked after parsing — Zod cannot await a setting.
  password: z.string().min(1, "Password is required"),
});

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, "reset-password", 10, 60_000);
  if (limited) return limited;
  try {
    const body = await request.json();
    const { token, password } = resetPasswordSchema.parse(body);

    const pwError = await validatePassword(password);
    if (pwError) {
      return NextResponse.json({ error: pwError }, { status: 400 });
    }

    await resetPassword(token, password);

    return NextResponse.json({
      success: true,
      message: "Password reset successfully! You can now log in with your new password.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation error",
          details: error.issues.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    console.error("Reset password error:", error);
    return NextResponse.json(
      { success: false, error: "An error occurred. Please try again." },
      { status: 500 }
    );
  }
}
