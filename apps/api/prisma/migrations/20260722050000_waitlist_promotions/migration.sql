ALTER TYPE "ParticipantStatus" ADD VALUE 'PENDING_CONFIRMATION' AFTER 'PENDING';

ALTER TABLE "match_participants"
ADD COLUMN "promotion_expires_at" TIMESTAMPTZ(3);
