-- The hot-path and PostGIS indexes were introduced with the Phase 2 match tables.
-- Keep these idempotent declarations here so the discovery migration documents
-- and enforces the complete P4-03 index set on upgraded databases.
CREATE INDEX IF NOT EXISTS "matches_city_id_status_starts_at_idx"
  ON "matches" ("city_id", "status", "starts_at");
CREATE INDEX IF NOT EXISTS "matches_location_gist_idx"
  ON "matches" USING GIST ("location");
CREATE INDEX IF NOT EXISTS "stadiums_location_gist_idx"
  ON "stadiums" USING GIST ("location");

-- PostgreSQL's built-in unaccent() is STABLE. The dictionary is fixed for this
-- database, so this immutable wrapper makes the indexed expression legal and
-- ensures the query uses exactly the same normalization as the index.
CREATE OR REPLACE FUNCTION futzone_unaccent(text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
STRICT
AS $$
  SELECT public.unaccent('public.unaccent', $1)
$$;

CREATE INDEX "matches_search_fts_idx" ON "matches" USING GIN (
  to_tsvector('simple', futzone_unaccent(COALESCE("title", '') || ' ' || COALESCE("address", '')))
);
CREATE INDEX "stadiums_search_fts_idx" ON "stadiums" USING GIN (
  to_tsvector('simple', futzone_unaccent(
    COALESCE("name_uz", '') || ' ' || COALESCE("name_ru", '') || ' '
    || COALESCE("name_en", '') || ' ' || COALESCE("address", '')
  ))
);

CREATE INDEX "matches_title_trgm_idx" ON "matches" USING GIN (futzone_unaccent("title") gin_trgm_ops);
CREATE INDEX "matches_address_trgm_idx" ON "matches" USING GIN (futzone_unaccent(COALESCE("address", '')) gin_trgm_ops);
CREATE INDEX "stadiums_name_uz_trgm_idx" ON "stadiums" USING GIN (futzone_unaccent("name_uz") gin_trgm_ops);
CREATE INDEX "stadiums_name_ru_trgm_idx" ON "stadiums" USING GIN (futzone_unaccent("name_ru") gin_trgm_ops);
CREATE INDEX "stadiums_name_en_trgm_idx" ON "stadiums" USING GIN (futzone_unaccent("name_en") gin_trgm_ops);
CREATE INDEX "stadiums_address_trgm_idx" ON "stadiums" USING GIN (futzone_unaccent("address") gin_trgm_ops);

-- Occupancy remains computed. This partial covering index makes each lateral
-- aggregate read only confirmed parties and their guest counts.
CREATE INDEX "match_participants_confirmed_occupancy_idx"
  ON "match_participants" ("match_id") INCLUDE ("guest_count")
  WHERE "status" = 'CONFIRMED'::"ParticipantStatus";
