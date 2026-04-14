-- Improve notification inbox listing (filter by user, order by created_at)
CREATE INDEX IF NOT EXISTS "idx_notifications_user_created" ON "notifications" ("user_id", "created_at" DESC);
