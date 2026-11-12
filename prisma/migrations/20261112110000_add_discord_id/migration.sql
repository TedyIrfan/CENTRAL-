-- AlterTable
ALTER TABLE "members" ADD COLUMN "discord_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "members_discord_id_key" ON "members"("discord_id");
