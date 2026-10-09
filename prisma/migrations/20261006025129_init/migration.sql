-- CreateEnum
CREATE TYPE "EventMode" AS ENUM ('kiosk', 'guest_mobile', 'hybrid');

-- CreateEnum
CREATE TYPE "FrameLayout" AS ENUM ('strip-2', 'strip-3', 'strip-4', 'grid-2x2');

-- CreateEnum
CREATE TYPE "BackgroundType" AS ENUM ('original', 'green', 'gradient', 'folder', 'upload');

-- CreateEnum
CREATE TYPE "PublishRequestType" AS ENUM ('frame', 'filter', 'background');

-- CreateEnum
CREATE TYPE "PublishStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT,
    "bride_name" TEXT,
    "groom_name" TEXT,
    "host_uid" TEXT NOT NULL,
    "host_email" TEXT,
    "event_date" TEXT NOT NULL,
    "venue" TEXT,
    "primary_frame_id" TEXT NOT NULL DEFAULT '',
    "frame_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allow_frame_selection" BOOLEAN NOT NULL DEFAULT true,
    "mode" "EventMode" NOT NULL DEFAULT 'hybrid',
    "enable_live_gallery" BOOLEAN NOT NULL DEFAULT true,
    "require_passcode" TEXT,
    "custom_logo_url" TEXT,
    "theme_color" TEXT NOT NULL DEFAULT '#e11d48',
    "custom_message" TEXT,
    "hashtag" TEXT,
    "wifi_ssid" TEXT,
    "wifi_password" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_captures" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "event_slug" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "strip_url" TEXT NOT NULL,
    "gif_url" TEXT,
    "photo_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "live_clip_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_captures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_frames" (
    "id" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT,
    "category_id" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_frames_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_frames" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "photo_count" INTEGER NOT NULL DEFAULT 4,
    "layout" "FrameLayout" NOT NULL DEFAULT 'strip-4',
    "aspect_ratio" DOUBLE PRECISION NOT NULL DEFAULT 1.333333,
    "color" TEXT NOT NULL DEFAULT '#f5f0e8',
    "border_color" TEXT NOT NULL DEFAULT '#1a1410',
    "accent_color" TEXT NOT NULL DEFAULT '#c9a84c',
    "emoji" TEXT NOT NULL DEFAULT '🎨',
    "config" JSONB,
    "width" INTEGER,
    "height" INTEGER,
    "owner_uid" TEXT,
    "owner_name" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "public_frames_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_filters" (
    "id" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '📷',
    "adjustments" JSONB NOT NULL,
    "css" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_filters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_filters" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '📷',
    "adjustments" JSONB NOT NULL,
    "css" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "owner_uid" TEXT,
    "owner_name" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "public_filters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_backgrounds" (
    "id" TEXT NOT NULL,
    "owner_uid" TEXT NOT NULL,
    "owner_name" TEXT,
    "type" "BackgroundType" NOT NULL,
    "name" TEXT NOT NULL,
    "src" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_backgrounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_backgrounds" (
    "id" TEXT NOT NULL,
    "owner_uid" TEXT,
    "owner_name" TEXT,
    "type" "BackgroundType" NOT NULL,
    "name" TEXT NOT NULL,
    "src" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "public_backgrounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publish_requests" (
    "id" TEXT NOT NULL,
    "type" "PublishRequestType" NOT NULL DEFAULT 'frame',
    "status" "PublishStatus" NOT NULL DEFAULT 'pending',
    "frame_id" TEXT,
    "filter_id" TEXT,
    "background_id" TEXT,
    "user_uid" TEXT NOT NULL,
    "user_display_name" TEXT,
    "frame" JSONB,
    "filter" JSONB,
    "background" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "publish_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3),

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studio_settings" (
    "id" TEXT NOT NULL DEFAULT 'studio',
    "studio_name" TEXT NOT NULL DEFAULT 'Pika',
    "studio_logo" TEXT NOT NULL DEFAULT '📷',
    "tagline" TEXT NOT NULL DEFAULT 'Capture the moment',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "studio_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");

-- CreateIndex
CREATE INDEX "events_host_uid_idx" ON "events"("host_uid");

-- CreateIndex
CREATE INDEX "event_captures_event_id_created_at_idx" ON "event_captures"("event_id", "created_at");

-- CreateIndex
CREATE INDEX "event_captures_session_id_idx" ON "event_captures"("session_id");

-- CreateIndex
CREATE INDEX "user_frames_uid_idx" ON "user_frames"("uid");

-- CreateIndex
CREATE INDEX "public_frames_owner_uid_idx" ON "public_frames"("owner_uid");

-- CreateIndex
CREATE INDEX "public_frames_active_sort_order_idx" ON "public_frames"("active", "sort_order");

-- CreateIndex
CREATE INDEX "user_filters_uid_idx" ON "user_filters"("uid");

-- CreateIndex
CREATE INDEX "public_filters_owner_uid_idx" ON "public_filters"("owner_uid");

-- CreateIndex
CREATE INDEX "public_filters_active_sort_order_idx" ON "public_filters"("active", "sort_order");

-- CreateIndex
CREATE INDEX "user_backgrounds_owner_uid_idx" ON "user_backgrounds"("owner_uid");

-- CreateIndex
CREATE INDEX "public_backgrounds_owner_uid_idx" ON "public_backgrounds"("owner_uid");

-- CreateIndex
CREATE INDEX "publish_requests_status_idx" ON "publish_requests"("status");

-- CreateIndex
CREATE INDEX "publish_requests_user_uid_idx" ON "publish_requests"("user_uid");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_key" ON "api_keys"("key");

-- CreateIndex
CREATE INDEX "api_keys_uid_idx" ON "api_keys"("uid");

-- AddForeignKey
ALTER TABLE "event_captures" ADD CONSTRAINT "event_captures_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
