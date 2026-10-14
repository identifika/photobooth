-- AlterTable
ALTER TABLE "studio_settings" ADD COLUMN     "ai_api_key" TEXT,
ADD COLUMN     "ai_base_url" TEXT,
ADD COLUMN     "ai_daily_limit" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "ai_model" TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
ADD COLUMN     "ai_provider" TEXT NOT NULL DEFAULT 'gemini';
