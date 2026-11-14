-- CreateTable
CREATE TABLE "activities" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "negotiation" TEXT,
    "activity_date" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_participants" (
    "id" SERIAL NOT NULL,
    "activity_id" INTEGER NOT NULL,
    "member_id" INTEGER,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "activities_code_key" ON "activities"("code");

-- CreateIndex
CREATE INDEX "activities_activity_date_idx" ON "activities"("activity_date");

-- CreateIndex
CREATE INDEX "activity_participants_activity_id_idx" ON "activity_participants"("activity_id");

-- CreateIndex
CREATE INDEX "activity_participants_member_id_idx" ON "activity_participants"("member_id");

-- CreateIndex
CREATE UNIQUE INDEX "activity_participants_activity_id_member_id_key" ON "activity_participants"("activity_id", "member_id");

-- AddForeignKey
ALTER TABLE "activity_participants" ADD CONSTRAINT "activity_participants_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_participants" ADD CONSTRAINT "activity_participants_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
