-- Per-day, per-country, per-ad rollup of ad impressions, clicks and spend.
--
-- No ad event recorded a country anywhere before this, so "which country are my
-- clicks and impressions coming from?" had no answer. `AdEngagement` is the only
-- per-event ad row and it is pruned at 30 days, so a raw column there would have
-- answered for a month and never for a year. This is a durable rollup instead.
--
-- `country` is an ISO-3166-1 alpha-2 code, or the literal 'ZZ' for unknown. It is
-- NOT NULL on purpose: a nullable column drops out of every GROUP BY and every
-- chart, so unknown traffic would silently vanish and the remaining slices would
-- renormalise to 100%.
CREATE TABLE "AdCountryDailyStat" (
    "id" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "country" VARCHAR(2) NOT NULL,
    "date" DATE NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "spendUsd" DECIMAL(18,6) NOT NULL DEFAULT 0,

    CONSTRAINT "AdCountryDailyStat_pkey" PRIMARY KEY ("id")
);

-- The upsert key used by both writers (buffered impressions and the click bill).
CREATE UNIQUE INDEX "AdCountryDailyStat_adId_country_date_key"
    ON "AdCountryDailyStat"("adId", "country", "date");

-- The report scans a date window across every ad and groups by country; the
-- unique index above is adId-first and cannot serve that.
CREATE INDEX "AdCountryDailyStat_date_idx" ON "AdCountryDailyStat"("date");

-- "How did ONE country trend?" — the drill-down the breakdown leads to.
CREATE INDEX "AdCountryDailyStat_country_date_idx"
    ON "AdCountryDailyStat"("country", "date");

ALTER TABLE "AdCountryDailyStat"
    ADD CONSTRAINT "AdCountryDailyStat_adId_fkey"
    FOREIGN KEY ("adId") REFERENCES "Ad"("id") ON DELETE CASCADE ON UPDATE CASCADE;
