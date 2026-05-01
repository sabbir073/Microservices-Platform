/**
 * Smoke test: verify /api/profile's Prisma SELECT resolves with the regenerated
 * client. Run via: npx tsx scripts/smoke-profile.ts
 */
// Use the project's existing prisma singleton so we hit the same Accelerate
// connection the API routes use.
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { calculateProfileCompletion } from "../src/lib/profile-completion";

const PROFILE_FIELDS = {
  id: true,
  name: true,
  username: true,
  email: true,
  avatar: true,
  coverPhoto: true,
  bio: true,
  phone: true,
  country: true,
  language: true,
  timezone: true,
  level: true,
  xp: true,
  pointsBalance: true,
  cashBalance: true,
  totalEarnings: true,
  packageTier: true,
  packageExpiresAt: true,
  referralCode: true,
  kycStatus: true,
  emailVerified: true,
  phoneVerified: true,
  isBlueVerified: true,
  twoFactorEnabled: true,
  notificationsEnabled: true,
  emailNotifications: true,
  pushNotifications: true,
  firstName: true,
  lastName: true,
  gender: true,
  dateOfBirth: true,
  nidNumber: true,
  profession: true,
  maritalStatus: true,
  studyLevel: true,
  nationality: true,
  bloodGroup: true,
  secondaryEmail: true,
  secondaryPhone: true,
  street: true,
  village: true,
  city: true,
  subDistrict: true,
  district: true,
  subDivision: true,
  division: true,
  region: true,
  postalCode: true,
  theme: true,
  themeAccent: true,
  tags: true,
  privacyAvatar: true,
  privacyBio: true,
  privacyStats: true,
  privacyEarnings: true,
  privacyLocation: true,
  createdAt: true,
} as const;

async function run() {
  console.log("🔬 Smoke test: /api/profile query shape against regenerated Prisma client…\n");

  let sampleUser = await prisma.user.findFirst({ select: { id: true, email: true } });
  let cleanup: string | null = null;

  if (!sampleUser) {
    console.log("   No users in DB — creating a temp user for the SELECT test.");
    const tmp = await prisma.user.create({
      data: {
        email: `smoke-${Date.now()}@example.com`,
        referralCode: `ST${Date.now().toString(36).toUpperCase()}`,
      },
    });
    sampleUser = { id: tmp.id, email: tmp.email };
    cleanup = tmp.id;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: sampleUser.id },
      select: {
        ...PROFILE_FIELDS,
        _count: {
          select: {
            referrals: true,
            taskSubmissions: true,
            transactions: true,
            socialAccounts: true,
          },
        },
      },
    });

    if (!user) throw new Error("findUnique returned null");

    const expectedKeys = [...Object.keys(PROFILE_FIELDS), "_count"];
    const missing = expectedKeys.filter((k) => !(k in user));
    if (missing.length > 0) throw new Error(`Missing keys in result: ${missing.join(", ")}`);

    console.log("✅ User SELECT resolves —", expectedKeys.length, "fields confirmed.");
    console.log("   tags          =", JSON.stringify(user.tags));
    console.log("   themeAccent   =", user.themeAccent);
    console.log("   privacyAvatar =", user.privacyAvatar);
    console.log("   privacyBio    =", user.privacyBio);
    console.log("   privacyStats  =", user.privacyStats);
    console.log("   privacyEarn   =", user.privacyEarnings);
    console.log("   privacyLoc    =", user.privacyLocation);
    console.log("   _count        =", JSON.stringify(user._count));

    // SocialAccount works
    const social = await prisma.socialAccount.count({ where: { userId: sampleUser.id } });
    console.log("\n✅ SocialAccount.count works (got " + social + ").");

    // Daily mission works
    const dmCount = await prisma.dailyMissionTemplate.count();
    const drcCount = await prisma.dailyReferralClaim.count();
    console.log("✅ DailyMissionTemplate.count works (got " + dmCount + ").");
    console.log("✅ DailyReferralClaim.count works (got " + drcCount + ").");

    // Profile-completion helper
    const c = calculateProfileCompletion({
      avatar: user.avatar,
      coverPhoto: user.coverPhoto,
      firstName: user.firstName,
      lastName: user.lastName,
      bio: user.bio,
      gender: user.gender,
      dateOfBirth: user.dateOfBirth,
      nidNumber: user.nidNumber,
      emailVerified: user.emailVerified,
      phone: user.phone,
      phoneVerified: user.phoneVerified,
      country: user.country,
      city: user.city,
      street: user.street,
      postalCode: user.postalCode,
      kycStatus: user.kycStatus,
      tags: user.tags,
      socialAccountsCount: user._count.socialAccounts,
    });
    console.log(
      `✅ profile-completion helper works — ${c.percentage}% (${c.missing.length} items missing)`
    );

    console.log("\n🎉 ALL CHECKS PASSED. /api/profile will work after `rm -rf .next` + `npm run dev`.");
  } finally {
    if (cleanup) {
      await prisma.user.delete({ where: { id: cleanup } });
      console.log("\n🧹 Cleaned up temp user.");
    }
    await prisma.$disconnect();
  }
}

run().catch((err) => {
  console.error("\n❌ Smoke test FAILED:\n", err);
  process.exit(1);
});
