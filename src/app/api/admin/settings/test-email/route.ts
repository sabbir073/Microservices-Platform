import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getMailConfig, buildTransport } from "@/lib/mailer";

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await can(session.user.id, "settings.edit"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Test what the admin actually SAVED, not what the process booted with. This
  // route read env vars only, so an owner who configured SMTP on the settings
  // screen, saved it, and pressed "Send test email" was told it wasn't
  // configured — the one message guaranteed to make them think it was broken.
  const cfg = await getMailConfig();
  const { host, port } = cfg;

  if (!cfg.configured) {
    return NextResponse.json(
      {
        error: "SMTP not configured",
        details:
          "Fill in SMTP Host, Username and Password on the Email tab and press Save (or set SMTP_HOST / SMTP_USER / SMTP_PASSWORD), then retry.",
      },
      { status: 400 }
    );
  }

  if (!session.user.email) {
    return NextResponse.json(
      { error: "Admin account has no email" },
      { status: 400 }
    );
  }

  try {
    const transporter = buildTransport(cfg);

    const appName = cfg.fromName;
    const sentAt = new Date().toLocaleString();

    await transporter.sendMail({
      from: cfg.from,
      to: session.user.email,
      subject: `[${appName}] SMTP Test Email`,
      text: `This is a test email from your ${appName} admin panel.\n\nSent at: ${sentAt}\nSent by: ${session.user.email}\n\nIf you're seeing this, your SMTP settings are working correctly.`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 24px; border-radius: 12px; color: white; margin-bottom: 24px;">
            <h1 style="margin: 0; font-size: 22px;">${appName}</h1>
            <p style="margin: 4px 0 0; opacity: 0.9; font-size: 14px;">SMTP Test Email</p>
          </div>
          <p style="color: #374151; font-size: 15px; line-height: 1.6;">
            <strong>Success!</strong> Your SMTP configuration is working correctly.
          </p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 14px;">
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Sent at</td>
              <td style="padding: 8px 0; color: #111827; text-align: right;">${sentAt}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Sent to</td>
              <td style="padding: 8px 0; color: #111827; text-align: right;">${session.user.email}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">SMTP Host</td>
              <td style="padding: 8px 0; color: #111827; text-align: right;">${host}:${port}</td>
            </tr>
          </table>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
            This is an automated test email triggered from your admin settings panel.
          </p>
        </div>
      `,
    });

    return NextResponse.json({
      success: true,
      message: `Test email sent to ${session.user.email}`,
    });
  } catch (err) {
    console.error("Test email failed:", err);
    return NextResponse.json(
      {
        error: "Failed to send test email",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
