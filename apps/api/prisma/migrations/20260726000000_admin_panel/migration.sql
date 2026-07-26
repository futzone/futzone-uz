-- P5-09: audit log viewer filters by target and by action, in addition to actor.
CREATE INDEX "audit_logs_target_type_target_id_created_at_idx" ON "audit_logs"("target_type", "target_id", "created_at");
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");

-- P5-05: nightly-aggregated dashboard metrics (one row per day).
CREATE TABLE "admin_metrics_daily" (
  "date" DATE NOT NULL,
  "total_users" INTEGER NOT NULL,
  "new_users" INTEGER NOT NULL,
  "active_users_7d" INTEGER NOT NULL,
  "active_users_30d" INTEGER NOT NULL,
  "dau" INTEGER NOT NULL,
  "wau" INTEGER NOT NULL,
  "matches_created" INTEGER NOT NULL,
  "matches_completed" INTEGER NOT NULL,
  "matches_cancelled" INTEGER NOT NULL,
  "attendance_pct" DECIMAL(5,2),
  "activity_by_city" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_metrics_daily_pkey" PRIMARY KEY ("date")
);
