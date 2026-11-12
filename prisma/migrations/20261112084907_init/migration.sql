-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('AKTIF', 'TIDAK_AKTIF', 'DITURUNKAN', 'TIDAK_DIKETAHUI');

-- CreateTable
CREATE TABLE "positions" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "members" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "position_id" INTEGER,
    "steam" TEXT,
    "hex" TEXT,
    "status" "MemberStatus" NOT NULL DEFAULT 'TIDAK_DIKETAHUI',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "positions_name_key" ON "positions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "members_hex_key" ON "members"("hex");

-- CreateIndex
CREATE INDEX "members_status_idx" ON "members"("status");

-- CreateIndex
CREATE INDEX "members_position_id_idx" ON "members"("position_id");

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
