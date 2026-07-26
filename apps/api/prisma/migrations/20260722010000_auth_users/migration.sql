CREATE TYPE "Position" AS ENUM ('GK', 'DEF', 'MID', 'FWD', 'UNIVERSAL');
CREATE TYPE "UserRole" AS ENUM ('USER', 'MODERATOR', 'ADMIN');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'WARNED', 'SUSPENDED', 'BANNED');
CREATE TYPE "OtpPurpose" AS ENUM ('REGISTER', 'LOGIN');

CREATE TABLE "cities" (
  "id" UUID PRIMARY KEY, "slug" TEXT NOT NULL UNIQUE, "name_uz" TEXT NOT NULL,
  "name_uz_cyrl" TEXT NOT NULL, "name_ru" TEXT NOT NULL, "name_en" TEXT NOT NULL,
  "region" TEXT NOT NULL, "lat" DECIMAL(9,6) NOT NULL, "lng" DECIMAL(9,6) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true
);
CREATE TABLE "users" (
  "id" UUID PRIMARY KEY, "phone" TEXT NOT NULL UNIQUE, "phone_verified_at" TIMESTAMPTZ(3),
  "first_name" TEXT NOT NULL, "last_name" TEXT NOT NULL, "username" TEXT NOT NULL UNIQUE,
  "avatar_url" TEXT, "bio" VARCHAR(300), "city_id" UUID, "position" "Position",
  "locale" TEXT NOT NULL DEFAULT 'uz', "role" "UserRole" NOT NULL DEFAULT 'USER',
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE', "suspended_until" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "deleted_at" TIMESTAMPTZ(3),
  CONSTRAINT "users_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id")
);
CREATE TABLE "otp_requests" (
  "id" UUID PRIMARY KEY, "phone" TEXT NOT NULL, "code_hash" TEXT NOT NULL,
  "purpose" "OtpPurpose" NOT NULL, "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0, "consumed_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "ip" TEXT NOT NULL
);
CREATE TABLE "sessions" (
  "id" UUID PRIMARY KEY, "user_id" UUID NOT NULL, "refresh_token_hash" TEXT NOT NULL,
  "family" UUID NOT NULL, "expires_at" TIMESTAMPTZ(3) NOT NULL, "revoked_at" TIMESTAMPTZ(3),
  "user_agent" TEXT, "ip" TEXT NOT NULL, "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX "users_phone_idx" ON "users"("phone");
CREATE INDEX "users_username_idx" ON "users"("username");
CREATE INDEX "otp_requests_phone_purpose_created_at_idx" ON "otp_requests"("phone", "purpose", "created_at");
CREATE INDEX "sessions_family_idx" ON "sessions"("family");
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");
CREATE INDEX "users_username_trgm_idx" ON "users" USING GIN ("username" gin_trgm_ops);
