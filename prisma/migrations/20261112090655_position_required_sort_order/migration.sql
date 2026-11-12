/*
  Warnings:

  - Made the column `position_id` on table `members` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "members" DROP CONSTRAINT "members_position_id_fkey";

-- AlterTable
ALTER TABLE "members" ALTER COLUMN "position_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "positions" ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
