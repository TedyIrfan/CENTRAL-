-- CreateEnum
CREATE TYPE "VaultStatus" AS ENUM ('SIAP', 'DIPINJAM', 'HILANG', 'RUSAK');

-- CreateTable
CREATE TABLE "vault_items" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "serial_number" TEXT,
    "is_weapon" BOOLEAN NOT NULL DEFAULT true,
    "durability" INTEGER,
    "status" "VaultStatus" NOT NULL DEFAULT 'SIAP',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vault_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vault_items_serial_number_key" ON "vault_items"("serial_number");

-- CreateIndex
CREATE INDEX "vault_items_status_idx" ON "vault_items"("status");

-- CreateIndex
CREATE INDEX "vault_items_name_idx" ON "vault_items"("name");
