-- Favorite stadiums (P4-06): lightweight two-column join, computed nothing, cascade on user/stadium delete.
CREATE TABLE "favorite_stadiums" (
  "user_id" UUID NOT NULL,
  "stadium_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "favorite_stadiums_pkey" PRIMARY KEY ("user_id", "stadium_id"),
  CONSTRAINT "favorite_stadiums_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "favorite_stadiums_stadium_id_fkey" FOREIGN KEY ("stadium_id") REFERENCES "stadiums"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "favorite_stadiums_stadium_id_idx" ON "favorite_stadiums"("stadium_id");

-- Favorite organizers (P4-06): self-referential user↔user favorite.
CREATE TABLE "favorite_organizers" (
  "user_id" UUID NOT NULL,
  "organizer_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "favorite_organizers_pkey" PRIMARY KEY ("user_id", "organizer_id"),
  CONSTRAINT "favorite_organizers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "favorite_organizers_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "favorite_organizers_organizer_id_idx" ON "favorite_organizers"("organizer_id");
