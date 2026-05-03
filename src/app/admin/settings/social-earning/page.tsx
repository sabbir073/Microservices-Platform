import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasPermission, type UserRole } from "@/lib/rbac";
import { SocialEarningForm } from "@/components/admin/settings/social-earning-form";

const CATEGORY = "social_earning";

export default async function SocialEarningSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const adminRole = session.user.role as UserRole | undefined;
  if (!hasPermission(adminRole, "settings.view")) redirect("/admin");

  const canEdit = hasPermission(adminRole, "settings.edit");

  const rows = await prisma.systemSetting.findMany({
    where: { category: CATEGORY },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));

  const initial = {
    enabled: (map.get("social_earning.enabled") as boolean) ?? true,
    daily_cap_per_user:
      (map.get("social_earning.daily_cap_per_user") as number) ?? 500,
    cap_per_post: (map.get("social_earning.cap_per_post") as number) ?? 100,
    min_account_age_hours:
      (map.get("social_earning.min_account_age_hours") as number) ?? 24,
    activities: {
      post_create: {
        enabled:
          (map.get("social_earning.post_create_enabled") as boolean) ?? true,
        points: (map.get("social_earning.post_create_points") as number) ?? 5,
      },
      view_received: {
        enabled:
          (map.get("social_earning.view_received_enabled") as boolean) ?? false,
        points: (map.get("social_earning.view_received_points") as number) ?? 0,
      },
      like_received: {
        enabled:
          (map.get("social_earning.like_received_enabled") as boolean) ?? true,
        points: (map.get("social_earning.like_received_points") as number) ?? 1,
      },
      vote_received: {
        enabled:
          (map.get("social_earning.vote_received_enabled") as boolean) ?? true,
        points: (map.get("social_earning.vote_received_points") as number) ?? 1,
      },
      comment_received: {
        enabled:
          (map.get("social_earning.comment_received_enabled") as boolean) ??
          true,
        points:
          (map.get("social_earning.comment_received_points") as number) ?? 2,
      },
      share_received: {
        enabled:
          (map.get("social_earning.share_received_enabled") as boolean) ?? true,
        points:
          (map.get("social_earning.share_received_points") as number) ?? 3,
      },
      donation_received: {
        enabled:
          (map.get("social_earning.donation_received_enabled") as boolean) ??
          false,
        points:
          (map.get("social_earning.donation_received_points") as number) ?? 0,
      },
      mention_received: {
        enabled:
          (map.get("social_earning.mention_received_enabled") as boolean) ??
          true,
        points:
          (map.get("social_earning.mention_received_points") as number) ?? 1,
      },
    },
  };

  return <SocialEarningForm initial={initial} canEdit={canEdit} />;
}
