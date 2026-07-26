CREATE TYPE "RatingStatus" AS ENUM ('ACTIVE', 'HIDDEN', 'REMOVED');

CREATE TABLE "ratings" (
    "id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "rater_id" UUID NOT NULL,
    "ratee_id" UUID NOT NULL,
    "discipline" INTEGER NOT NULL,
    "punctuality" INTEGER NOT NULL,
    "fair_play" INTEGER NOT NULL,
    "team_play" INTEGER NOT NULL,
    "overall" INTEGER NOT NULL,
    "comment" VARCHAR(500),
    "status" "RatingStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),
    CONSTRAINT "ratings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ratings_scores_check" CHECK (
      "discipline" BETWEEN 1 AND 5 AND
      "punctuality" BETWEEN 1 AND 5 AND
      "fair_play" BETWEEN 1 AND 5 AND
      "team_play" BETWEEN 1 AND 5 AND
      "overall" BETWEEN 1 AND 5
    )
);

CREATE TABLE "reports" (
    "id" UUID NOT NULL,
    "rating_id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ratings_match_id_rater_id_ratee_id_key" ON "ratings"("match_id", "rater_id", "ratee_id");
CREATE INDEX "ratings_ratee_id_status_idx" ON "ratings"("ratee_id", "status");
CREATE INDEX "ratings_rater_id_status_idx" ON "ratings"("rater_id", "status");
CREATE UNIQUE INDEX "reports_rating_id_reporter_id_key" ON "reports"("rating_id", "reporter_id");
CREATE INDEX "reports_rating_id_created_at_idx" ON "reports"("rating_id", "created_at");

ALTER TABLE "ratings" ADD CONSTRAINT "ratings_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_rater_id_fkey" FOREIGN KEY ("rater_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_ratee_id_fkey" FOREIGN KEY ("ratee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reports" ADD CONSTRAINT "reports_rating_id_fkey" FOREIGN KEY ("rating_id") REFERENCES "ratings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
