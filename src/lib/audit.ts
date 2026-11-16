import { prisma } from "@/lib/prisma";
import type { AuditSource, MemberAuditAction, Prisma } from "@prisma/client";

/** Pelaku perubahan: dari web (tanpa login) atau dari bot Discord (ada nama & ID). */
export type Actor = {
  source: AuditSource;
  id?: string | null;
  name?: string | null;
};

/** Perubahan satu field: nilai sebelum dan sesudah. */
export type FieldChange = { from: string | null; to: string | null };

export const WEB_ACTOR: Actor = { source: "WEB", id: null, name: null };

function clip(value: string | null | undefined, max: number): string | null {
  const text = (value ?? "").trim().replace(/\s+/g, " ");
  return text ? text.slice(0, max) : null;
}

/**
 * Bot mengirim identitasnya lewat header karena tidak ada login:
 *   x-actor-source: discord
 *   x-actor-id: 123456789012345678
 *   x-actor-name: <nama tampilan, URL-encoded>
 * Tanpa header itu, perubahan dianggap berasal dari web.
 */
export function actorFromRequest(request: Request): Actor {
  const headers = request.headers;
  const source: AuditSource = headers.get("x-actor-source") === "discord" ? "DISCORD" : "WEB";
  const rawName = headers.get("x-actor-name");
  let name: string | null = null;
  if (rawName) {
    try {
      name = clip(decodeURIComponent(rawName), 80);
    } catch {
      name = clip(rawName, 80);
    }
  }
  return { source, id: clip(headers.get("x-actor-id"), 40), name };
}

/** Catat satu perubahan. Kegagalan mencatat tidak boleh membatalkan perubahan datanya. */
export async function recordMemberAudit(input: {
  memberId: number | null;
  memberName: string;
  action: MemberAuditAction;
  actor: Actor;
  changes?: Record<string, FieldChange> | null;
}) {
  try {
    await prisma.memberAudit.create({
      data: {
        memberId: input.memberId,
        memberName: input.memberName,
        action: input.action,
        source: input.actor.source,
        actorId: input.actor.id ?? null,
        actorName: input.actor.name ?? null,
        changes: (input.changes ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (err) {
    console.error("[audit] gagal mencatat perubahan:", err);
  }
}

export type AuditRow = {
  id: number;
  memberId: number | null;
  memberName: string;
  action: MemberAuditAction;
  source: AuditSource;
  actorId: string | null;
  actorName: string | null;
  changes: Record<string, FieldChange> | null;
  createdAt: string;
};

export async function listMemberAudits(params: {
  memberId?: number;
  search?: string;
  pageSize?: number;
}): Promise<{ data: AuditRow[] }> {
  const where: Prisma.MemberAuditWhereInput = {};
  if (params.memberId !== undefined) where.memberId = params.memberId;
  if (params.search) where.memberName = { contains: params.search, mode: "insensitive" };

  const rows = await prisma.memberAudit.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(params.pageSize ?? 50, 1), 100),
  });

  return {
    data: rows.map((r) => ({
      id: r.id,
      memberId: r.memberId,
      memberName: r.memberName,
      action: r.action,
      source: r.source,
      actorId: r.actorId,
      actorName: r.actorName,
      changes: (r.changes as Record<string, FieldChange> | null) ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}
