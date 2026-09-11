-- Indexes for three queries that run on every feed load.
--
-- Strictly additive: three CREATE INDEX statements, no drops, no type changes,
-- no data movement. Safe to re-run (IF NOT EXISTS).
--
-- NOT `CONCURRENTLY`, unlike 20260820120000_hot_path_indexes, and that is a
-- deliberate difference. CONCURRENTLY exists to avoid write-locking a large
-- table while an index builds, and it costs a manual multi-step apply because it
-- cannot run inside a transaction block. Measured against the live database
-- (pg_stat_user_tables), the two tables touched here are:
--
--     Post          ~20 live tuples
--     Transaction   ~253 live tuples
--
-- The largest table on the platform is RateLimitHit at 3,088 rows. At that size
-- a plain CREATE INDEX completes in single-digit milliseconds and the lock is
-- not observable, so paying for CONCURRENTLY buys nothing and costs the ability
-- to apply this with one command. Revisit if Post or Transaction reaches the low
-- millions: that is the point where the exclusive lock starts to be felt and a
-- future index on these tables should go back to CONCURRENTLY.
--
-- Apply with:  npx prisma migrate deploy

-- ── Post: the main feed's pool read ─────────────────────────────────────────
-- GET /api/feed:
--   where  { isHidden: false, groupId: null, isAnnouncement: false, isPromoted: false }
--   order  [{ isPinned: desc }, { lastActivityAt: desc }]   take 500
--
-- Why the existing indexes did not cover it: every composite built for the feed
-- leads with "isPublic", and "isPublic" was later removed from the feed
-- predicate (it became the author's internet-audience choice, not in-platform
-- visibility — Members-only posts belong in the signed-in feed). A B-tree cannot
-- skip its leading column, so all of those indexes became unusable for this
-- query the moment that filter went away and the pool read fell back to a
-- sequential scan plus a sort. Nothing broke, so nothing surfaced it: the query
-- still returned exactly the right rows. pg_stat_user_tables recorded 11,406
-- sequential scans of Post against 986 index scans.
--
-- Column order: the four equality predicates first, then the two sort keys in
-- sort order, so Postgres walks the index backwards and never sorts.
CREATE INDEX IF NOT EXISTS "Post_feedPool_idx"
  ON "Post" ("isHidden", "groupId", "isAnnouncement", "isPromoted", "isPinned", "lastActivityAt");

-- ── Post: the live-activity pulse ───────────────────────────────────────────
-- GET /api/feed/pulse:
--   _max(lastActivityAt) where { isHidden: false, isAnnouncement: false, isPromoted: false }
--
-- Separate from the index above rather than sharing its prefix, because pulse
-- deliberately does NOT constrain groupId. With groupId sitting between the
-- equality columns and lastActivityAt, the planner would have to read every
-- matching row to find the maximum. Here lastActivityAt follows the three
-- equality columns directly, so the answer is the first entry of a backward
-- index scan.
CREATE INDEX IF NOT EXISTS "Post_isHidden_isAnnouncement_isPromoted_lastActivityAt_idx"
  ON "Post" ("isHidden", "isAnnouncement", "isPromoted", "lastActivityAt");

-- ── Transaction: "today's earnings" on the feed right rail ──────────────────
-- GET /api/feed/rail-widgets, called on every feed mount:
--   _sum(points) where { userId, status: 'COMPLETED',
--                        type IN ('EARNING','BONUS'),
--                        createdAt >= localMidnight }
--
-- Why the existing indexes did not cover it: the closest is
-- [userId, type, createdAt], which omits "status" entirely — so the scan walks
-- every EARNING/BONUS row the user has in the window and re-checks status per
-- row. [status, createdAt] leads on the wrong column to help a single user.
--
-- Column order: equality (userId), equality (status), IN-list (type), range
-- (createdAt) — the order that lets one scan satisfy all four predicates.
-- Transaction is the fastest-growing table on the platform, so this index earns
-- more with every payment rather than less.
CREATE INDEX IF NOT EXISTS "Transaction_userId_status_type_createdAt_idx"
  ON "Transaction" ("userId", "status", "type", "createdAt");
