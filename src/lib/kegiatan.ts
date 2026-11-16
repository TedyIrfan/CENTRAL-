import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/errors";
import { compactDate, parseDateInput, startOfMonthWib, todayWib } from "@/lib/dates";

type Fields = Record<string, string>;

function fail(fields: Fields): never {
  throw new ApiError(422, "Validasi gagal", fields);
}

type ParticipantInput = { memberId: number | null; name: string };

// ---------- validasi ----------

function parseTitle(v: unknown, errors: Fields): string | undefined {
  if (typeof v !== "string" || v.trim() === "") {
    errors.title = "Nama kegiatan wajib diisi";
    return;
  }
  const title = v.trim().replace(/\s+/g, " ");
  if (title.length < 3) {
    errors.title = "Nama kegiatan minimal 3 karakter";
    return;
  }
  if (title.length > 120) {
    errors.title = "Nama kegiatan maksimal 120 karakter";
    return;
  }
  return title;
}

function parseNegotiation(v: unknown, errors: Fields): string | null | undefined {
  if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) return null;
  if (typeof v !== "string") {
    errors.negotiation = "Negosiasi harus berupa teks";
    return;
  }
  const text = v.trim();
  if (text.length > 200) {
    errors.negotiation = "Negosiasi maksimal 200 karakter";
    return;
  }
  return text;
}

function parseActivityDate(v: unknown, errors: Fields, required = false): Date | undefined {
  if (v === undefined || v === null || v === "") {
    if (required) errors.activityDate = "Tanggal kegiatan wajib diisi";
    return;
  }
  const date = parseDateInput(v);
  if (!date) {
    errors.activityDate = "Tanggal kegiatan tidak valid (format YYYY-MM-DD)";
    return;
  }
  return date;
}

async function parseParticipants(v: unknown, errors: Fields): Promise<ParticipantInput[]> {
  if (!Array.isArray(v) || v.length === 0) {
    errors.participants = "Minimal 1 peserta";
    return [];
  }
  if (v.length > 50) {
    errors.participants = "Maksimal 50 peserta";
    return [];
  }

  const cleaned: ParticipantInput[] = [];
  for (const raw of v) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      errors.participants = "Format peserta tidak valid";
      return [];
    }
    const item = raw as Record<string, unknown>;
    const memberId =
      typeof item.memberId === "number" && Number.isInteger(item.memberId) && item.memberId > 0
        ? item.memberId
        : null;
    const name =
      typeof item.name === "string" ? item.name.trim().replace(/\s+/g, " ") : "";

    if (memberId === null) {
      if (name.length < 2) {
        errors.participants = "Nama peserta minimal 2 karakter";
        return [];
      }
      if (name.length > 60) {
        errors.participants = "Nama peserta maksimal 60 karakter";
        return [];
      }
    }
    cleaned.push({ memberId, name });
  }

  const memberIds = cleaned.flatMap((p) => (p.memberId === null ? [] : [p.memberId]));
  if (memberIds.length > 0) {
    const members = await prisma.member.findMany({
      where: { id: { in: memberIds } },
      select: { id: true, name: true },
    });
    const names = new Map(members.map((m) => [m.id, m.name]));
    for (const p of cleaned) {
      if (p.memberId === null) continue;
      const dbName = names.get(p.memberId);
      if (!dbName) {
        errors.participants = "Ada anggota yang tidak ditemukan";
        return [];
      }
      p.name = dbName;
    }
  }

  const seenMembers = new Set<number>();
  const seenNames = new Set<string>();
  for (const p of cleaned) {
    if (p.memberId !== null) {
      if (seenMembers.has(p.memberId)) {
        errors.participants = "Ada anggota yang dipilih lebih dari sekali";
        return [];
      }
      seenMembers.add(p.memberId);
    }
    const key = p.name.toLowerCase();
    if (seenNames.has(key)) {
      errors.participants = `Peserta "${p.name}" dipilih lebih dari sekali`;
      return [];
    }
    seenNames.add(key);
  }

  return cleaned;
}

function parseDiscordMessageId(v: unknown, errors: Fields): string | undefined {
  if (v === undefined || v === null || v === "") return;
  if (typeof v !== "string" || !/^\d{15,21}$/.test(v)) {
    errors.discordMessageId = "discordMessageId tidak valid";
    return;
  }
  return v;
}

function parseCreatedBy(v: unknown, errors: Fields): string | undefined {
  if (v === undefined || v === null || v === "") return;
  if (typeof v !== "string") {
    errors.createdBy = "createdBy harus berupa teks";
    return;
  }
  const text = v.trim();
  if (text.length > 100) {
    errors.createdBy = "createdBy maksimal 100 karakter";
    return;
  }
  return text || undefined;
}

// ---------- helper ----------

async function nextCode(db: Prisma.TransactionClient, date: Date) {
  const prefix = `KGT-${compactDate(date)}-`;
  const last = await db.activity.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  const next = last ? Number(last.code.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}

type ActivityWithParticipants = Prisma.ActivityGetPayload<{ include: { participants: true } }>;

function serialize(a: ActivityWithParticipants) {
  return {
    id: a.id,
    code: a.code,
    title: a.title,
    negotiation: a.negotiation,
    activityDate: a.activityDate.toISOString(),
    discordMessageId: a.discordMessageId,
    participants: a.participants
      .slice()
      .sort((x, y) => x.sortOrder - y.sortOrder || x.id - y.id)
      .map((p) => ({ id: p.id, memberId: p.memberId, name: p.name, sortOrder: p.sortOrder })),
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

// ---------- query ----------

export type ActivityListParams = {
  search?: string;
  from?: Date;
  to?: Date;
  memberId?: number;
  discordMessageId?: string;
  page: number;
  pageSize: number;
};

export function parseActivityListParams(sp: URLSearchParams): ActivityListParams {
  const errors: Fields = {};
  const result: ActivityListParams = { page: 1, pageSize: 20 };

  const search = sp.get("search");
  if (search?.trim()) result.search = search.trim();

  const from = sp.get("from");
  if (from) {
    const d = parseDateInput(from);
    if (!d) errors.from = "from tidak valid";
    else result.from = d;
  }

  const to = sp.get("to");
  if (to) {
    const d = parseDateInput(to);
    if (!d) errors.to = "to tidak valid";
    else result.to = d;
  }

  if (result.from && result.to && result.from > result.to) {
    errors.to = "Tanggal akhir harus setelah tanggal awal";
  }

  const memberId = sp.get("memberId");
  if (memberId) {
    if (!/^\d+$/.test(memberId) || Number(memberId) < 1) errors.memberId = "memberId tidak valid";
    else result.memberId = Number(memberId);
  }

  const discordMessageId = sp.get("discordMessageId");
  if (discordMessageId) {
    if (!/^\d{15,21}$/.test(discordMessageId)) errors.discordMessageId = "discordMessageId tidak valid";
    else result.discordMessageId = discordMessageId;
  }

  const page = sp.get("page");
  if (page) {
    if (!/^\d+$/.test(page) || Number(page) < 1 || Number(page) > 1_000_000) errors.page = "page tidak valid";
    else result.page = Number(page);
  }

  const pageSize = sp.get("pageSize");
  if (pageSize) {
    if (!/^\d+$/.test(pageSize) || Number(pageSize) < 1 || Number(pageSize) > 100) {
      errors.pageSize = "pageSize harus 1-100";
    } else result.pageSize = Number(pageSize);
  }

  if (Object.keys(errors).length) fail(errors);
  return result;
}

function buildWhere(
  p: Pick<ActivityListParams, "search" | "from" | "to" | "memberId" | "discordMessageId">,
) {
  const where: Prisma.ActivityWhereInput = {};
  if (p.from || p.to) {
    where.activityDate = {
      ...(p.from ? { gte: p.from } : {}),
      ...(p.to ? { lte: p.to } : {}),
    };
  }
  if (p.memberId) where.participants = { some: { memberId: p.memberId } };
  if (p.discordMessageId) where.discordMessageId = p.discordMessageId;
  if (p.search) {
    where.OR = [
      { code: { contains: p.search, mode: "insensitive" } },
      { title: { contains: p.search, mode: "insensitive" } },
      { negotiation: { contains: p.search, mode: "insensitive" } },
      { participants: { some: { name: { contains: p.search, mode: "insensitive" } } } },
    ];
  }
  return where;
}

export async function listActivities(p: ActivityListParams) {
  const where = buildWhere(p);
  const [total, rows] = await Promise.all([
    prisma.activity.count({ where }),
    prisma.activity.findMany({
      where,
      include: { participants: true },
      orderBy: [{ activityDate: "desc" }, { id: "desc" }],
      skip: (p.page - 1) * p.pageSize,
      take: p.pageSize,
    }),
  ]);
  return {
    data: rows.map(serialize),
    meta: { page: p.page, pageSize: p.pageSize, total, totalPages: Math.ceil(total / p.pageSize) },
  };
}

export async function getActivity(id: number) {
  const row = await prisma.activity.findUnique({ where: { id }, include: { participants: true } });
  if (!row) throw new ApiError(404, "Kegiatan tidak ditemukan");
  return serialize(row);
}

export async function activityStats() {
  const monthStart = startOfMonthWib();
  const [total, kegiatanBulanIni, pesertaBulanIni] = await Promise.all([
    prisma.activity.count(),
    prisma.activity.count({ where: { activityDate: { gte: monthStart } } }),
    prisma.activityParticipant.count({
      where: { activity: { activityDate: { gte: monthStart } } },
    }),
  ]);
  return { total, kegiatanBulanIni, pesertaBulanIni };
}

export async function activitySuggestions() {
  const rows = await prisma.activity.groupBy({
    by: ["title"],
    _max: { createdAt: true },
    orderBy: { _max: { createdAt: "desc" } },
    take: 30,
  });
  return rows.map((r) => r.title);
}

// ---------- mutasi ----------

export async function createActivity(input: Record<string, unknown>) {
  const errors: Fields = {};
  const title = parseTitle(input.title, errors);
  const negotiation = parseNegotiation(input.negotiation, errors);
  const activityDate = parseActivityDate(input.activityDate, errors) ?? parseDateInput(todayWib())!;
  const participants = await parseParticipants(input.participants, errors);
  const discordMessageId = parseDiscordMessageId(input.discordMessageId, errors);
  const createdBy = parseCreatedBy(input.createdBy, errors);
  if (Object.keys(errors).length) fail(errors);

  return prisma.$transaction(async (tx) => {
    const row = await tx.activity.create({
      data: {
        code: await nextCode(tx, activityDate),
        title: title!,
        negotiation: negotiation ?? null,
        activityDate,
        createdBy: createdBy ?? "web",
        ...(discordMessageId ? { discordMessageId } : {}),
        participants: {
          create: participants.map((p, index) => ({
            memberId: p.memberId,
            name: p.name,
            sortOrder: index,
          })),
        },
      },
      include: { participants: true },
    });
    return serialize(row);
  });
}

export async function updateActivity(id: number, input: Record<string, unknown>) {
  const current = await prisma.activity.findUnique({
    where: { id },
    select: { id: true, activityDate: true },
  });
  if (!current) throw new ApiError(404, "Kegiatan tidak ditemukan");

  const errors: Fields = {};
  const data: Prisma.ActivityUpdateInput = {};

  if ("title" in input) data.title = parseTitle(input.title, errors);
  if ("negotiation" in input) data.negotiation = parseNegotiation(input.negotiation, errors);

  let participants: ParticipantInput[] | null = null;
  if ("participants" in input) participants = await parseParticipants(input.participants, errors);

  if ("activityDate" in input) {
    const date = parseActivityDate(input.activityDate, errors, true);
    if (date) {
      data.activityDate = date;
      // kode mengikuti tanggal kegiatan, hanya dihitung ulang jika tanggal berubah
      if (compactDate(date) !== compactDate(current.activityDate)) {
        data.code = await nextCode(prisma, date);
      }
    }
  }

  if (Object.keys(errors).length) fail(errors);

  return prisma.$transaction(async (tx) => {
    if (participants) {
      await tx.activityParticipant.deleteMany({ where: { activityId: id } });
      await tx.activityParticipant.createMany({
        data: participants.map((p, index) => ({
          activityId: id,
          memberId: p.memberId,
          name: p.name,
          sortOrder: index,
        })),
      });
    }
    const row = await tx.activity.update({
      where: { id },
      data,
      include: { participants: true },
    });
    return serialize(row);
  });
}

export async function deleteActivity(id: number) {
  const row = await prisma.activity.findUnique({ where: { id }, select: { code: true } });
  if (!row) throw new ApiError(404, "Kegiatan tidak ditemukan");
  await prisma.activity.delete({ where: { id } });
  return { id, code: row.code };
}
