-- CreateEnum
CREATE TYPE "WdStatus" AS ENUM ('DIPINJAM', 'DIKEMBALIKAN', 'HILANG');

-- CreateTable
CREATE TABLE "wd_records" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "member_id" INTEGER,
    "borrower_name" TEXT NOT NULL,
    "item_name" TEXT NOT NULL,
    "is_weapon" BOOLEAN NOT NULL DEFAULT false,
    "serial_number" TEXT,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "durability_start" INTEGER,
    "durability_return" INTEGER,
    "taken_at" TIMESTAMP(3) NOT NULL,
    "returned_at" TIMESTAMP(3),
    "purpose" TEXT NOT NULL,
    "return_note" TEXT,
    "lost_reason" TEXT,
    "status" "WdStatus" NOT NULL DEFAULT 'DIPINJAM',
    "discord_message_id" TEXT,
    "created_by" TEXT,
    "returned_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wd_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wd_records_code_key" ON "wd_records"("code");

-- CreateIndex
CREATE INDEX "wd_records_status_idx" ON "wd_records"("status");

-- CreateIndex
CREATE INDEX "wd_records_borrower_name_idx" ON "wd_records"("borrower_name");

-- CreateIndex
CREATE INDEX "wd_records_serial_number_idx" ON "wd_records"("serial_number");

-- CreateIndex
CREATE INDEX "wd_records_taken_at_idx" ON "wd_records"("taken_at");

-- AddForeignKey
ALTER TABLE "wd_records" ADD CONSTRAINT "wd_records_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
