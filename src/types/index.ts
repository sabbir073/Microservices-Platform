// User types
export type UserRole = "USER" | "SUPER_ADMIN" | "ADMIN" | "EDITOR" | "FINANCE_ADMIN" | "MODERATOR";
export type UserStatus = "ACTIVE" | "SUSPENDED" | "BANNED" | "PENDING_VERIFICATION";
export type KYCStatus = "NOT_SUBMITTED" | "PENDING" | "APPROVED" | "REJECTED";
export type PackageTier = "FREE" | "BASIC" | "STANDARD" | "PREMIUM";

// Task types
export type TaskType = "VIDEO" | "ARTICLE" | "QUIZ" | "SURVEY" | "SOCIAL" | "PROXY" | "OFFERWALL" | "CUSTOM";
export type TaskStatus = "ACTIVE" | "PAUSED" | "COMPLETED" | "EXPIRED";
export type SubmissionStatus = "PENDING" | "APPROVED" | "REJECTED" | "AUTO_APPROVED";

// Transaction types
export type TransactionType = "EARNING" | "WITHDRAWAL" | "BONUS" | "REFERRAL" | "PURCHASE" | "REFUND" | "PENALTY" | "GIFT" | "LOTTERY_WIN" | "CHECKIN";
export type TransactionStatus = "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED";
export type WithdrawalStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "REJECTED" | "CANCELLED";
export type PaymentMethod = "BKASH" | "NAGAD" | "ROCKET" | "BINANCE" | "PAYPAL";

// Other types
export type MarketplaceListingStatus = "ACTIVE" | "SOLD" | "CANCELLED" | "EXPIRED";
export type CourseStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type LotteryStatus = "UPCOMING" | "ACTIVE" | "COMPLETED" | "CANCELLED";
export type NotificationType = "SYSTEM" | "TASK" | "WALLET" | "REFERRAL" | "PROMOTION" | "ACHIEVEMENT" | "LOTTERY" | "SOCIAL";

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// User interfaces
export interface User {
  id: string;
  email: string;
  emailVerified?: Date;
  phone?: string;
  name?: string;
  username?: string;
  avatar?: string;
  bio?: string;
  country?: string;
  role: UserRole;
  status: UserStatus;
  pointsBalance: number;
  cashBalance: number;
  totalEarnings: number;
  xp: number;
  level: number;
  streak: number;
  packageTier: PackageTier;
  packageExpiresAt?: Date;
  kycStatus: KYCStatus;
  referralCode: string;
  theme: string;
  createdAt: Date;
  updatedAt: Date;
}

// Task interfaces
export interface Task {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  pointsReward: number;
  xpReward: number;
  dailyLimit?: number;
  totalLimit?: number;
  completedCount: number;
  minLevel: number;
  requiredPackage: PackageTier;
  thumbnailUrl?: string;
  duration?: number;
  autoApprove: boolean;
  createdAt: Date;
}

// Transaction interfaces
export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  status: TransactionStatus;
  points: number;
  amount: number;
  description?: string;
  reference?: string;
  createdAt: Date;
}

// Withdrawal interfaces
export interface Withdrawal {
  id: string;
  userId: string;
  amount: number;
  fee: number;
  netAmount: number;
  method: PaymentMethod;
  status: WithdrawalStatus;
  rejectionReason?: string;
  createdAt: Date;
}

// Notification interfaces
export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
}

// Package interfaces
export interface Package {
  id: string;
  tier: PackageTier;
  name: string;
  description?: string;
  priceMonthly: number;
  priceYearly?: number;
  dailyTaskLimit: number;
  withdrawalFee: number;
  minWithdrawal: number;
  features: string[];
  referralBonus: number;
  xpMultiplier: number;
}

// Leaderboard interfaces
export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  avatar?: string;
  level: number;
  value: number; // earnings or XP depending on type
}
