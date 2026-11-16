-- AlterTable
ALTER TABLE "wd_records" ADD COLUMN "due_at" TIMESTAMP(3);
ALTER TABLE "wd_records" ADD COLUMN "reminder_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "wd_records_status_due_at_idx" ON "wd_records"("status", "due_at");
