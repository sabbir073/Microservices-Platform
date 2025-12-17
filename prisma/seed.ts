import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";

// For seeding, use Prisma Accelerate
const prisma = new PrismaClient({
  accelerateUrl: process.env.DATABASE_URL!,
});

async function main() {
  console.log("Starting seed...");

  // Delete all existing users first
  console.log("Deleting all existing users...");
  await prisma.user.deleteMany({});
  console.log("All users deleted!");

  // Common password for all test users
  const password = await bcrypt.hash("Test@123", 12);

  // Users to create with their roles
  const users = [
    {
      email: "superadmin@earngpt.com",
      name: "Super Admin",
      username: "superadmin",
      referralCode: "SUPER001",
      role: "SUPER_ADMIN" as const,
      pointsBalance: 1000000,
      cashBalance: 50000,
      xp: 100000,
      level: 100,
    },
    {
      email: "finance@earngpt.com",
      name: "Finance Admin",
      username: "financeadmin",
      referralCode: "FINANCE01",
      role: "FINANCE_ADMIN" as const,
      pointsBalance: 500000,
      cashBalance: 25000,
      xp: 50000,
      level: 50,
    },
    {
      email: "content@earngpt.com",
      name: "Content Admin",
      username: "contentadmin",
      referralCode: "CONTENT01",
      role: "CONTENT_ADMIN" as const,
      pointsBalance: 500000,
      cashBalance: 25000,
      xp: 50000,
      level: 50,
    },
    {
      email: "support@earngpt.com",
      name: "Support Admin",
      username: "supportadmin",
      referralCode: "SUPPORT01",
      role: "SUPPORT_ADMIN" as const,
      pointsBalance: 500000,
      cashBalance: 25000,
      xp: 50000,
      level: 50,
    },
    {
      email: "marketing@earngpt.com",
      name: "Marketing Admin",
      username: "marketingadmin",
      referralCode: "MARKET01",
      role: "MARKETING_ADMIN" as const,
      pointsBalance: 500000,
      cashBalance: 25000,
      xp: 50000,
      level: 50,
    },
    {
      email: "moderator@earngpt.com",
      name: "Moderator",
      username: "moderator",
      referralCode: "MOD00001",
      role: "MODERATOR" as const,
      pointsBalance: 250000,
      cashBalance: 10000,
      xp: 25000,
      level: 25,
    },
    {
      email: "user@earngpt.com",
      name: "Demo User",
      username: "demouser",
      referralCode: "USER0001",
      role: "USER" as const,
      pointsBalance: 5000,
      cashBalance: 100,
      xp: 250,
      level: 2,
    },
  ];

  // Create users - try to find existing first, then update or create
  for (const userData of users) {
    try {
      // Check if user exists
      const existing = await prisma.user.findUnique({
        where: { email: userData.email },
      });

      if (existing) {
        // Update existing user
        const user = await prisma.user.update({
          where: { email: userData.email },
          data: {
            password,
            name: userData.name,
            role: userData.role,
            pointsBalance: userData.pointsBalance,
            cashBalance: userData.cashBalance,
            xp: userData.xp,
            level: userData.level,
            status: "ACTIVE",
          },
        });
        console.log(`Updated ${userData.role}: ${user.email}`);
      } else {
        // Create new user
        const user = await prisma.user.create({
          data: {
            email: userData.email,
            password,
            name: userData.name,
            username: userData.username,
            referralCode: userData.referralCode,
            status: "ACTIVE",
            emailVerified: new Date(),
            role: userData.role,
            pointsBalance: userData.pointsBalance,
            cashBalance: userData.cashBalance,
            xp: userData.xp,
            level: userData.level,
            country: "BD",
          },
        });
        console.log(`Created ${userData.role}: ${user.email}`);
      }
    } catch (error) {
      console.log(`Failed to create ${userData.role}: ${userData.email}`, error);
    }
  }

  // Create some sample tasks
  const tasks = await prisma.task.createMany({
    skipDuplicates: true,
    data: [
      {
        title: "Watch Introduction Video",
        description: "Watch our welcome video to learn how EarnGPT works and start earning points!",
        type: "VIDEO",
        status: "ACTIVE",
        pointsReward: 50,
        xpReward: 10,
        dailyLimit: 1,
        autoApprove: true,
        contentUrl: "https://youtube.com/watch?v=example",
        duration: 120,
      },
      {
        title: "Complete Daily Survey",
        description: "Answer a few questions about your preferences and earn points!",
        type: "SURVEY",
        status: "ACTIVE",
        pointsReward: 100,
        xpReward: 20,
        dailyLimit: 3,
        autoApprove: true,
      },
      {
        title: "Follow us on Twitter",
        description: "Follow our official Twitter account and earn bonus points!",
        type: "SOCIAL",
        status: "ACTIVE",
        pointsReward: 200,
        xpReward: 30,
        totalLimit: 1,
        socialPlatform: "Twitter",
        socialAction: "follow",
        socialUrl: "https://twitter.com/earngpt",
      },
      {
        title: "Read Article: Crypto Basics",
        description: "Learn about cryptocurrency basics and earn while you learn!",
        type: "ARTICLE",
        status: "ACTIVE",
        pointsReward: 75,
        xpReward: 15,
        dailyLimit: 5,
        autoApprove: true,
        duration: 300,
      },
      {
        title: "Complete Quiz: Web3 Knowledge",
        description: "Test your Web3 knowledge and earn bonus points for correct answers!",
        type: "QUIZ",
        status: "ACTIVE",
        pointsReward: 150,
        xpReward: 25,
        dailyLimit: 2,
        questions: JSON.stringify([
          { question: "What is blockchain?", options: ["A", "B", "C", "D"], correct: 0 },
          { question: "What is a smart contract?", options: ["A", "B", "C", "D"], correct: 1 },
        ]),
      },
    ],
  });
  console.log(`Created ${tasks.count} sample tasks`);

  // Create packages
  const packages = await prisma.package.createMany({
    skipDuplicates: true,
    data: [
      {
        tier: "FREE",
        name: "Free",
        description: "Get started with basic features",
        priceMonthly: 0,
        priceYearly: 0,
        dailyTaskLimit: 10,
        withdrawalFee: 5,
        minWithdrawal: 500,
        features: ["10 tasks per day", "Standard withdrawals", "Basic support"],
        xpMultiplier: 1,
        order: 0,
      },
      {
        tier: "BASIC",
        name: "Basic",
        description: "More tasks, better rewards",
        priceMonthly: 4.99,
        priceYearly: 49.99,
        dailyTaskLimit: 25,
        withdrawalFee: 3,
        minWithdrawal: 300,
        features: ["25 tasks per day", "Lower withdrawal fees", "Email support", "1.5x XP bonus"],
        referralBonus: 5,
        xpMultiplier: 1.5,
        order: 1,
      },
      {
        tier: "STANDARD",
        name: "Standard",
        description: "For serious earners",
        priceMonthly: 9.99,
        priceYearly: 99.99,
        dailyTaskLimit: 50,
        withdrawalFee: 1,
        minWithdrawal: 100,
        features: ["50 tasks per day", "Minimal fees", "Priority support", "2x XP bonus", "Exclusive tasks"],
        referralBonus: 10,
        xpMultiplier: 2,
        order: 2,
      },
      {
        tier: "PREMIUM",
        name: "Premium",
        description: "Maximum earning potential",
        priceMonthly: 19.99,
        priceYearly: 199.99,
        dailyTaskLimit: 100,
        withdrawalFee: 0,
        minWithdrawal: 50,
        features: ["Unlimited tasks", "No withdrawal fees", "VIP support", "3x XP bonus", "All exclusive tasks", "Early access"],
        referralBonus: 20,
        xpMultiplier: 3,
        order: 3,
      },
    ],
  });
  console.log(`Created ${packages.count} packages`);

  // Create referral levels
  const referralLevels = await prisma.referralLevel.createMany({
    skipDuplicates: true,
    data: [
      { level: 1, commissionRate: 10, description: "Direct referrals - 10% commission" },
      { level: 2, commissionRate: 5, description: "Second level - 5% commission" },
      { level: 3, commissionRate: 2, description: "Third level - 2% commission" },
    ],
  });
  console.log(`Created ${referralLevels.count} referral levels`);

  // Create some badges
  const badges = await prisma.badge.createMany({
    skipDuplicates: true,
    data: [
      { name: "Early Bird", description: "Joined during beta", icon: "bird", color: "#3B82F6", requirement: "beta_user", xpReward: 100 },
      { name: "Task Master", description: "Completed 100 tasks", icon: "star", color: "#F59E0B", requirement: "tasks_100", xpReward: 500 },
      { name: "Referral King", description: "Referred 10 users", icon: "crown", color: "#8B5CF6", requirement: "referrals_10", xpReward: 1000 },
      { name: "Streak Champion", description: "7 day login streak", icon: "fire", color: "#EF4444", requirement: "streak_7", xpReward: 200 },
      { name: "Big Spender", description: "Purchased Premium", icon: "diamond", color: "#06B6D4", requirement: "premium_user", xpReward: 500 },
    ],
  });
  console.log(`Created ${badges.count} badges`);

  // Create achievements
  const achievements = await prisma.achievement.createMany({
    skipDuplicates: true,
    data: [
      { name: "First Task", description: "Complete your first task", icon: "target", type: "tasks", threshold: 1, pointsReward: 50, xpReward: 10 },
      { name: "Task Beginner", description: "Complete 10 tasks", icon: "clipboard", type: "tasks", threshold: 10, pointsReward: 200, xpReward: 50 },
      { name: "Task Pro", description: "Complete 50 tasks", icon: "trophy", type: "tasks", threshold: 50, pointsReward: 500, xpReward: 150 },
      { name: "First Referral", description: "Refer your first friend", icon: "users", type: "referrals", threshold: 1, pointsReward: 100, xpReward: 25 },
      { name: "Referral Star", description: "Refer 5 friends", icon: "star", type: "referrals", threshold: 5, pointsReward: 500, xpReward: 100 },
      { name: "First Withdrawal", description: "Make your first withdrawal", icon: "wallet", type: "withdrawals", threshold: 1, pointsReward: 100, xpReward: 25 },
    ],
  });
  console.log(`Created ${achievements.count} achievements`);

  console.log("\n========================================");
  console.log("  Seed completed successfully!");
  console.log("========================================");
  console.log("\n All accounts use the same password: Test@123");
  console.log("\n Test Accounts:");
  console.log("----------------------------------------");
  console.log(" SUPER_ADMIN:");
  console.log("   Email: superadmin@earngpt.com");
  console.log("");
  console.log(" FINANCE_ADMIN:");
  console.log("   Email: finance@earngpt.com");
  console.log("");
  console.log(" CONTENT_ADMIN:");
  console.log("   Email: content@earngpt.com");
  console.log("");
  console.log(" SUPPORT_ADMIN:");
  console.log("   Email: support@earngpt.com");
  console.log("");
  console.log(" MARKETING_ADMIN:");
  console.log("   Email: marketing@earngpt.com");
  console.log("");
  console.log(" MODERATOR:");
  console.log("   Email: moderator@earngpt.com");
  console.log("");
  console.log(" USER:");
  console.log("   Email: user@earngpt.com");
  console.log("----------------------------------------");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
