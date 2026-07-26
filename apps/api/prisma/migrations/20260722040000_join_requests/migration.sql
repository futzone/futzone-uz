CREATE TYPE "JoinRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');

CREATE TABLE "join_requests" (
  "id" UUID NOT NULL,
  "match_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "message" TEXT,
  "guest_count" INTEGER NOT NULL DEFAULT 0,
  "status" "JoinRequestStatus" NOT NULL DEFAULT 'PENDING',
  "decided_by_id" UUID,
  "decided_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "join_requests_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_guest_count_check" CHECK ("guest_count" >= 0);
CREATE UNIQUE INDEX "join_requests_match_id_user_id_key" ON "join_requests"("match_id", "user_id");
CREATE INDEX "join_requests_match_id_status_created_at_idx" ON "join_requests"("match_id", "status", "created_at");
ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
