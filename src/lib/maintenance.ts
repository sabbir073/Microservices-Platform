import "server-only";
import { getSetting } from "@/lib/system-settings";
import { can } from "@/lib/permissions";

/**
 * Maintenance mode.
 *
 * The General settings tab has had a red "Maintenance Mode — show maintenance
 * page to all users" switch since the beginning, and it wrote a
 * `SystemSetting` row that **nothing read**. An owner flipping it during an
 * incident would have believed the platform was closed while every page, task
 * and payout carried on exactly as before. A kill-switch that does not kill is
 * more dangerous than no kill-switch, because it stops you reaching for a real
 * one.
 *
 * Staff are deliberately let through: someone has to be able to see whether the
 * thing they are fixing is fixed, and locking the admins out of the admin panel
 * during an outage is how a short incident becomes a long one. The gate is
 * checked in the authenticated app shell, so the marketing and login pages stay
 * up — people need to be able to read the notice and sign in once it lifts.
 */
export interface MaintenanceState {
  active: boolean;
  message: string;
}

const DEFAULT_MESSAGE =
  "We are performing scheduled maintenance. Please check back shortly.";

/**
 * Whether the platform is closed *for this user*. Returns `active: false` for
 * anyone holding `settings.edit` — the permission that could turn it off again.
 */
export async function maintenanceFor(
  userId: string | null | undefined
): Promise<MaintenanceState> {
  const on = await getSetting<boolean>("maintenance_mode", false);
  if (on !== true) return { active: false, message: "" };

  const raw = await getSetting<string>("maintenance_message", "");
  const message = (typeof raw === "string" && raw.trim()) || DEFAULT_MESSAGE;

  if (userId) {
    // `can()` is cached and already on this request's hot path in the shell.
    const isStaff = await can(userId, "settings.edit").catch(() => false);
    if (isStaff) return { active: false, message };
  }

  return { active: true, message };
}
