-- A lighter application than AGENCY for people who only want to buy tasks.
--
-- The only route to `createTasks` was applying for AGENCY, which grants
-- `agencyMode` + `advertiser` alongside it. So a shopkeeper who wanted 200
-- people to follow their page had to be handed a full agency console and an
-- ad-campaign builder they never asked for, and an admin who wanted to grant
-- just the one capability had no application type to approve.
--
-- TASK_BUYER grants `createTasks` and `socialTasks` and nothing else.
ALTER TYPE "CreatorApplicationType" ADD VALUE IF NOT EXISTS 'TASK_BUYER';
