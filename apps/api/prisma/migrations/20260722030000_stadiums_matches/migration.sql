CREATE TYPE "Surface" AS ENUM ('NATURAL_GRASS', 'ARTIFICIAL_GRASS', 'PARQUET', 'RUBBER', 'CONCRETE');
CREATE TYPE "Level" AS ENUM ('BEGINNER', 'AMATEUR', 'INTERMEDIATE', 'ADVANCED', 'ANY');
CREATE TYPE "JoinMode" AS ENUM ('AUTO', 'MANUAL', 'INVITE_ONLY');
CREATE TYPE "AgeGroup" AS ENUM ('YOUTH', 'ADULT', 'MIXED');
CREATE TYPE "MatchStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'FULL', 'STARTED', 'FINISHED', 'ATTENDANCE_PENDING', 'RATING_PENDING', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ParticipantRole" AS ENUM ('OWNER', 'ASSISTANT', 'PLAYER');
CREATE TYPE "ParticipantStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DECLINED', 'LEFT', 'REMOVED', 'WAITLISTED');
CREATE TYPE "StadiumStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "stadiums" (
  "id" UUID NOT NULL, "slug" TEXT NOT NULL, "name_uz" TEXT NOT NULL, "name_ru" TEXT NOT NULL, "name_en" TEXT NOT NULL,
  "city_id" UUID NOT NULL, "district" TEXT NOT NULL, "address" TEXT NOT NULL,
  "location" geography(Point,4326) NOT NULL, "surface" "Surface" NOT NULL, "photos" TEXT[] NOT NULL,
  "status" "StadiumStatus" NOT NULL DEFAULT 'PENDING', "created_by_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "stadiums_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "stadiums_slug_key" ON "stadiums"("slug");
CREATE INDEX "stadiums_city_id_status_idx" ON "stadiums"("city_id", "status");
CREATE INDEX "stadiums_location_gist_idx" ON "stadiums" USING GIST ("location");

CREATE TABLE "matches" (
  "id" UUID NOT NULL, "slug" TEXT NOT NULL, "owner_id" UUID NOT NULL, "title" TEXT NOT NULL, "format" TEXT NOT NULL,
  "total_slots" INTEGER NOT NULL, "starts_at" TIMESTAMPTZ(3) NOT NULL, "duration_min" INTEGER NOT NULL,
  "city_id" UUID NOT NULL, "stadium_id" UUID, "address" TEXT, "location" geography(Point,4326),
  "field_price_uzs" INTEGER NOT NULL, "per_player_fee_uzs" INTEGER NOT NULL, "surface" "Surface" NOT NULL,
  "level" "Level" NOT NULL, "join_mode" "JoinMode" NOT NULL, "min_rating" DECIMAL(2,1), "min_attendance_pct" INTEGER,
  "allow_new_players" BOOLEAN NOT NULL DEFAULT true, "needed_positions" "Position"[] NOT NULL,
  "age_group" "AgeGroup" NOT NULL DEFAULT 'MIXED', "verified_phone_only" BOOLEAN NOT NULL DEFAULT false,
  "status" "MatchStatus" NOT NULL DEFAULT 'DRAFT', "cancelled_reason" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "deleted_at" TIMESTAMPTZ(3),
  CONSTRAINT "matches_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "matches_location_source_check" CHECK ("stadium_id" IS NOT NULL OR ("address" IS NOT NULL AND "location" IS NOT NULL)),
  CONSTRAINT "matches_money_nonnegative_check" CHECK ("field_price_uzs" >= 0 AND "per_player_fee_uzs" >= 0),
  CONSTRAINT "matches_slots_positive_check" CHECK ("total_slots" > 0)
);
CREATE UNIQUE INDEX "matches_slug_key" ON "matches"("slug");
CREATE INDEX "matches_city_id_status_starts_at_idx" ON "matches"("city_id", "status", "starts_at");
CREATE INDEX "matches_location_gist_idx" ON "matches" USING GIST ("location");

CREATE TABLE "match_participants" (
  "id" UUID NOT NULL, "match_id" UUID NOT NULL, "user_id" UUID NOT NULL, "role" "ParticipantRole" NOT NULL,
  "status" "ParticipantStatus" NOT NULL, "guest_count" INTEGER NOT NULL DEFAULT 0, "waitlist_position" INTEGER,
  "joined_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "left_at" TIMESTAMPTZ(3),
  CONSTRAINT "match_participants_pkey" PRIMARY KEY ("id"), CONSTRAINT "match_participants_guest_count_check" CHECK ("guest_count" >= 0)
);
CREATE UNIQUE INDEX "match_participants_match_id_user_id_key" ON "match_participants"("match_id", "user_id");
CREATE INDEX "match_participants_match_id_status_idx" ON "match_participants"("match_id", "status");

CREATE TABLE "notifications" (
  "id" UUID NOT NULL, "user_id" UUID NOT NULL, "match_id" UUID, "type" TEXT NOT NULL, "payload" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

CREATE TABLE "audit_logs" (
  "id" UUID NOT NULL, "actor_id" UUID NOT NULL, "action" TEXT NOT NULL, "target_type" TEXT NOT NULL,
  "target_id" UUID NOT NULL, "metadata" JSONB, "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");

ALTER TABLE "stadiums" ADD CONSTRAINT "stadiums_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stadiums" ADD CONSTRAINT "stadiums_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "matches" ADD CONSTRAINT "matches_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "matches" ADD CONSTRAINT "matches_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "matches" ADD CONSTRAINT "matches_stadium_id_fkey" FOREIGN KEY ("stadium_id") REFERENCES "stadiums"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMENT ON COLUMN "stadiums"."location" IS 'PostGIS geography point. Read with ST_Y(location::geometry)/ST_X(location::geometry); write with ST_SetSRID(ST_MakePoint(longitude, latitude),4326)::geography.';
COMMENT ON COLUMN "matches"."location" IS 'PostGIS geography point. Read with ST_Y(location::geometry)/ST_X(location::geometry); write with ST_SetSRID(ST_MakePoint(longitude, latitude),4326)::geography.';
