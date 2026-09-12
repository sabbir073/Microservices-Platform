-- Staff manager tier: one step below SUPER_ADMIN, walled off from finance.
-- Enforcement lives in src/lib/rbac.ts (canAdministerStaffAccount /
-- canAssignStaffRole) and src/lib/permissions.ts (stripProtectedForRole).
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'MANAGER';
