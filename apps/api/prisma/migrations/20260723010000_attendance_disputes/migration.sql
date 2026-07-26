CREATE TYPE "AttendanceStatus" AS ENUM ('ON_TIME', 'LATE', 'NO_SHOW', 'CANCELLED_EARLY', 'EXCUSED', 'REMOVED_BY_OWNER');
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'UPHELD', 'OVERTURNED');
CREATE TABLE "attendance_records" (
  "id" UUID NOT NULL, "match_id" UUID NOT NULL, "participant_id" UUID NOT NULL,
  "status" "AttendanceStatus" NOT NULL, "guest_no_show_count" INTEGER NOT NULL DEFAULT 0,
  "marked_by_id" UUID NOT NULL, "marked_at" TIMESTAMPTZ(3) NOT NULL,
  "dispute_status" "DisputeStatus", "dispute_note" TEXT,
  "dispute_resolved_by_id" UUID, "finalized_at" TIMESTAMPTZ(3),
  CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "attendance_records_participant_id_key" ON "attendance_records"("participant_id");
CREATE INDEX "attendance_records_match_id_idx" ON "attendance_records"("match_id");
CREATE INDEX "attendance_records_finalized_at_idx" ON "attendance_records"("finalized_at");
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "match_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_marked_by_id_fkey" FOREIGN KEY ("marked_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_dispute_resolved_by_id_fkey" FOREIGN KEY ("dispute_resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
