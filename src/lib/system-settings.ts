import { prisma } from "@/lib/prisma";

/**
 * Read a SystemSetting JSON value by key, falling back to `fallback` when the
 * row is missing or the DB is unreachable. Centralises the findUnique+cast
 * pattern used across the app for admin-configurable settings.
 */
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  try {
    const row = await prisma.systemSetting.findUnique({ where: { key } });
    if (row?.value === undefined || row?.value === null) return fallback;
    return row.value as unknown as T;
  } catch {
    return fallback;
  }
}

/**
 * Resolve a secret/config value: prefer the env var, then a SystemSetting row
 * (under `category`, key === the env name lowercased is NOT assumed — pass the
 * exact settings key). Returns "" when neither is set.
 */
export async function getSecret(
  envName: string,
  settingKey: string
): Promise<string> {
  const env = process.env[envName];
  if (env) return env;
  const v = await getSetting<string>(settingKey, "");
  return typeof v === "string" ? v : "";
}
