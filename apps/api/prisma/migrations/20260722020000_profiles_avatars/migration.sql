ALTER TABLE "users"
  ADD COLUMN "username_changed_at" TIMESTAMPTZ(3),
  ADD COLUMN "avatar_upload_key" TEXT;

CREATE TYPE "AvatarUploadStatus" AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED');

CREATE TABLE "avatar_uploads" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "object_key" TEXT NOT NULL,
  "processed_key" TEXT NOT NULL,
  "expected_size" INTEGER NOT NULL,
  "status" "AvatarUploadStatus" NOT NULL DEFAULT 'PENDING',
  "previous_avatar_key" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "avatar_uploads_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "avatar_uploads_object_key_key" ON "avatar_uploads"("object_key");
CREATE UNIQUE INDEX "avatar_uploads_processed_key_key" ON "avatar_uploads"("processed_key");
CREATE INDEX "avatar_uploads_user_id_created_at_idx" ON "avatar_uploads"("user_id", "created_at");
ALTER TABLE "avatar_uploads" ADD CONSTRAINT "avatar_uploads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
