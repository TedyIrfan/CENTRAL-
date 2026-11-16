-- AlterTable
ALTER TABLE "activities" ADD COLUMN "discord_message_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "activities_discord_message_id_key" ON "activities"("discord_message_id");
