import { redirect } from "next/navigation";

// Moderation Queue is unified with Social Feed Moderation in Phase 3
// (both use the SocialReport model and share the same review workflow).
// This route redirects so admins land on the right page.
export default function ModerationQueueRedirect() {
  redirect("/admin/social-moderation");
}
