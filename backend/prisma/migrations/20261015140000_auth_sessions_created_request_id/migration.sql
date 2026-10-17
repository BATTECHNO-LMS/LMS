-- Security Phase 1B: correlate each server-side session with the login request (additive, nullable).
ALTER TABLE "auth_sessions" ADD COLUMN IF NOT EXISTS "created_request_id" VARCHAR(128);
