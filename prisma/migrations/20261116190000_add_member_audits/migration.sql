-- Jejak perubahan anggota (siapa mengubah apa, dari web atau bot Discord).
CREATE TYPE "AuditSource" AS ENUM ('WEB', 'DISCORD');
CREATE TYPE "MemberAuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'PROMOTE', 'DEMOTE');

CREATE TABLE "member_audits" (
    "id" SERIAL NOT NULL,
    "member_id" INTEGER,
    "member_name" TEXT NOT NULL,
    "action" "MemberAuditAction" NOT NULL,
    "source" "AuditSource" NOT NULL DEFAULT 'WEB',
    "actor_id" TEXT,
    "actor_name" TEXT,
    "changes" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_audits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "member_audits_member_id_idx" ON "member_audits"("member_id");
CREATE INDEX "member_audits_created_at_idx" ON "member_audits"("created_at");
