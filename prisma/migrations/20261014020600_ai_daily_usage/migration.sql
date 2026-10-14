-- CreateTable
CREATE TABLE "ai_daily_usage" (
    "id" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "usage_date" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "last_prompt" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_daily_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_daily_usage_usage_date_idx" ON "ai_daily_usage"("usage_date");

-- CreateIndex
CREATE UNIQUE INDEX "ai_daily_usage_uid_usage_date_key" ON "ai_daily_usage"("uid", "usage_date");
