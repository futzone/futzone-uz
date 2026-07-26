CREATE TABLE "user_stats" (
  "user_id" UUID NOT NULL,
  "matches_played" INTEGER NOT NULL DEFAULT 0,
  "matches_organized" INTEGER NOT NULL DEFAULT 0,
  "on_time" INTEGER NOT NULL DEFAULT 0,
  "late" INTEGER NOT NULL DEFAULT 0,
  "no_show" INTEGER NOT NULL DEFAULT 0,
  "cancelled_early" INTEGER NOT NULL DEFAULT 0,
  "excused" INTEGER NOT NULL DEFAULT 0,
  "attendance_pct" DECIMAL(5,2),
  "bayes_avg" DECIMAL(3,2),
  "rating_count" INTEGER NOT NULL DEFAULT 0,
  "last_five_avg" DECIMAL(3,2),
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "user_stats_pkey" PRIMARY KEY ("user_id"),
  CONSTRAINT "user_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "badges" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  CONSTRAINT "badges_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "badges_code_key" UNIQUE ("code")
);

CREATE TABLE "user_badges" (
  "user_id" UUID NOT NULL,
  "badge_code" TEXT NOT NULL,
  "awarded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_badges_pkey" PRIMARY KEY ("user_id", "badge_code"),
  CONSTRAINT "user_badges_user_id_badge_code_key" UNIQUE ("user_id", "badge_code"),
  CONSTRAINT "user_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "user_badges_badge_code_fkey" FOREIGN KEY ("badge_code") REFERENCES "badges"("code") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "badges" ("id", "code", "name", "description") VALUES
  ('019c1234-0000-7000-8000-000000000001', 'RELIABLE_PLAYER', 'Reliable Player', 'At least 90% attendance over 10 matches'),
  ('019c1234-0000-7000-8000-000000000002', 'TEN_MATCHES', '10 Matches', 'Played 10 matches'),
  ('019c1234-0000-7000-8000-000000000003', 'FIFTY_MATCHES', '50 Matches', 'Played 50 matches'),
  ('019c1234-0000-7000-8000-000000000004', 'PERFECT_ATTENDANCE', 'Perfect Attendance', 'No no-shows over at least 15 matches'),
  ('019c1234-0000-7000-8000-000000000005', 'TRUSTED_ORGANIZER', 'Trusted Organizer', 'Organized at least 10 matches with under 10% cancelled'),
  ('019c1234-0000-7000-8000-000000000006', 'FAIR_PLAY', 'Fair Play', 'At least a 4.5 fair-play average over 10 ratings');
