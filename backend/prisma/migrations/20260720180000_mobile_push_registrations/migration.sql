-- Additive: mobile push (FCM) device registration table.
-- Push delivery stays disabled until FIREBASE_PUSH_ENABLED + service-account
-- credentials are configured on the server (see backend/docs/MOBILE_PUSH_NOTIFICATIONS.md).

CREATE TABLE "mobile_push_registrations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "registration_token" VARCHAR(512) NOT NULL,
    "platform" VARCHAR(16) NOT NULL,
    "app_id" VARCHAR(120),
    "app_version" VARCHAR(40),
    "device_installation_id" VARCHAR(120),
    "locale" VARCHAR(16),
    "notification_permission_status" VARCHAR(32),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "disabled_at" TIMESTAMPTZ(6),
    "last_delivery_error" VARCHAR(500),
    "last_delivery_error_at" TIMESTAMPTZ(6),

    CONSTRAINT "mobile_push_registrations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "mobile_push_registrations_platform_check" CHECK ("platform" IN ('android', 'ios'))
);

CREATE UNIQUE INDEX "uq_mobile_push_registration_token" ON "mobile_push_registrations"("registration_token");

CREATE INDEX "idx_mobile_push_user_id" ON "mobile_push_registrations"("user_id");

CREATE INDEX "idx_mobile_push_user_active" ON "mobile_push_registrations"("user_id", "disabled_at");

CREATE INDEX "idx_mobile_push_last_seen" ON "mobile_push_registrations"("last_seen_at");
