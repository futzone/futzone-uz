-- P5-07: admin "flag as suspicious" queue.
ALTER TABLE "matches" ADD COLUMN "flagged_at" TIMESTAMPTZ(3);
ALTER TABLE "matches" ADD COLUMN "flagged_reason" TEXT;
ALTER TABLE "matches" ADD COLUMN "flagged_by_id" UUID;
CREATE INDEX "matches_flagged_at_idx" ON "matches"("flagged_at");
