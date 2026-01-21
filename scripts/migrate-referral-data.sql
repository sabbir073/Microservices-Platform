-- Migration script to copy commissionRate to commissionValue
-- and set default commissionType to PERCENTAGE

-- Update all existing referral levels
UPDATE "ReferralLevel"
SET
  "commissionValue" = COALESCE("commissionRate", 0),
  "commissionType" = 'PERCENTAGE'
WHERE "commissionRate" IS NOT NULL;

-- For any rows where commissionRate is NULL, set commissionValue to 0
UPDATE "ReferralLevel"
SET
  "commissionValue" = 0,
  "commissionType" = 'PERCENTAGE'
WHERE "commissionRate" IS NULL;
