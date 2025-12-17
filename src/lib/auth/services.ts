import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { generateReferralCode } from "@/lib/utils";
import { sendVerificationEmail, sendPasswordResetEmail } from "@/lib/email";
import { v4 as uuidv4 } from "uuid";

export async function registerUser({
  email,
  password,
  name,
  referralCode,
}: {
  email: string;
  password: string;
  name: string;
  referralCode?: string;
}) {
  // Check if email already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (existingUser) {
    throw new Error("Email already registered");
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12);

  // Find referrer if referral code provided
  let referredById: string | null = null;
  if (referralCode) {
    const referrer = await prisma.user.findUnique({
      where: { referralCode },
    });
    if (referrer) {
      referredById = referrer.id;
    }
  }

  // Generate unique referral code
  let newReferralCode = generateReferralCode();
  let codeExists = await prisma.user.findUnique({
    where: { referralCode: newReferralCode },
  });
  while (codeExists) {
    newReferralCode = generateReferralCode();
    codeExists = await prisma.user.findUnique({
      where: { referralCode: newReferralCode },
    });
  }

  // Create user
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      password: hashedPassword,
      name,
      referralCode: newReferralCode,
      referredById,
      status: "PENDING_VERIFICATION",
    },
  });

  // Create verification token
  const verificationToken = uuidv4();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await prisma.verificationToken.create({
    data: {
      identifier: email.toLowerCase(),
      token: verificationToken,
      expires,
      type: "EMAIL",
    },
  });

  // Send verification email
  await sendVerificationEmail(email, verificationToken, name);

  return { user, verificationToken };
}

export async function verifyEmail(token: string) {
  const verificationToken = await prisma.verificationToken.findUnique({
    where: { token },
  });

  if (!verificationToken) {
    throw new Error("Invalid verification token");
  }

  if (verificationToken.expires < new Date()) {
    await prisma.verificationToken.delete({
      where: { token },
    });
    throw new Error("Verification token has expired");
  }

  // Update user
  const user = await prisma.user.update({
    where: { email: verificationToken.identifier },
    data: {
      emailVerified: new Date(),
      status: "ACTIVE",
    },
  });

  // Delete used token
  await prisma.verificationToken.delete({
    where: { token },
  });

  // Award welcome bonus if configured
  const welcomeBonus = parseInt(process.env.WELCOME_BONUS_POINTS || "0", 10);
  if (welcomeBonus > 0) {
    await prisma.transaction.create({
      data: {
        userId: user.id,
        type: "BONUS",
        status: "COMPLETED",
        points: welcomeBonus,
        description: "Welcome bonus",
      },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: {
        pointsBalance: { increment: welcomeBonus },
      },
    });
  }

  return user;
}

export async function resendVerificationEmail(email: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (user.emailVerified) {
    throw new Error("Email already verified");
  }

  // Delete existing tokens
  await prisma.verificationToken.deleteMany({
    where: { identifier: email.toLowerCase(), type: "EMAIL" },
  });

  // Create new token
  const verificationToken = uuidv4();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.verificationToken.create({
    data: {
      identifier: email.toLowerCase(),
      token: verificationToken,
      expires,
      type: "EMAIL",
    },
  });

  await sendVerificationEmail(email, verificationToken, user.name || "User");

  return { success: true };
}

export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user) {
    // Don't reveal if user exists
    return { success: true };
  }

  // Delete existing reset tokens
  await prisma.verificationToken.deleteMany({
    where: { identifier: email.toLowerCase(), type: "PASSWORD_RESET" },
  });

  // Create reset token
  const resetToken = uuidv4();
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.verificationToken.create({
    data: {
      identifier: email.toLowerCase(),
      token: resetToken,
      expires,
      type: "PASSWORD_RESET",
    },
  });

  await sendPasswordResetEmail(email, resetToken, user.name || "User");

  return { success: true };
}

export async function resetPassword(token: string, newPassword: string) {
  const resetToken = await prisma.verificationToken.findFirst({
    where: { token, type: "PASSWORD_RESET" },
  });

  if (!resetToken) {
    throw new Error("Invalid reset token");
  }

  if (resetToken.expires < new Date()) {
    await prisma.verificationToken.delete({
      where: { token },
    });
    throw new Error("Reset token has expired");
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { email: resetToken.identifier },
    data: { password: hashedPassword },
  });

  await prisma.verificationToken.delete({
    where: { token },
  });

  return { success: true };
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user || !user.password) {
    throw new Error("User not found");
  }

  const passwordsMatch = await bcrypt.compare(currentPassword, user.password);

  if (!passwordsMatch) {
    throw new Error("Current password is incorrect");
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });

  return { success: true };
}
