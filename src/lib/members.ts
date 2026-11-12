import { MemberStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/errors";

const MAX_NAME = 100;

const STATUSES = Object.values(MemberStatus) as string[];
const HEX_RE = /^steam:[0-9a-f]{8,17}$/;
const DISCORD_ID_RE = /^\d{15,20}$/;

const include = { position: { select: { id: true, name: true, sortOrder: true } } } as const;

type MemberRow = Prisma.MemberGetPayload<{ include: typeof include }>;

function serialize(m: MemberRow) {
  return {
    id: m.id,
    name: m.name,
    position: { id: m.position.id, name: m.position.name },
    hex: m.hex,
    discordId: m.discordId,
    status: m.status,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

// ---------- validasi ----------

type Fields = Record<string, string>;

function fail(fields: Fields): never {
  throw new ApiError(422, "Validasi gagal", fields);
}

function parseName(v: unknown, errors: Fields): string | undefined {
  if (typeof v !== "string" || v.trim() === "") {
    errors.name = "Nama wajib diisi";
    return;
  }
  const name = v.trim().replace(/\s+/g, " ");
  if (name.length > MAX_NAME) {
    errors.name = `Nama maksimal ${MAX_NAME} karakter`;
    return;
  }
  return name;
}


function parseHex(v: unknown, errors: Fields): string | null | undefined {
  if (v === null || (typeof v === "string" && v.trim() === "")) return null;
  if (typeof v !== "string") {
    errors.hex = "Steam Hex harus berupa teks";
    return;
  }
  let hex = v.trim().toLowerCase();
  if (/^[0-9a-f]{8,17}$/.test(hex)) hex = `steam:${hex}`;
  if (!HEX_RE.test(hex)) {
    errors.hex = "Format Steam Hex tidak valid (contoh: steam:110000112345678)";
    return;
  }
  return hex;
}

function parseDiscordId(v: unknown, errors: Fields): string | null | undefined {
  if (v === null || (typeof v === "string" && v.trim() === "")) return null;
  if (typeof v !== "string") {
    errors.discordId = "ID Discord harus berupa teks";
    return;
  }
  // Terima mention <@123> atau <@!123>
  const id = v.trim().replace(/^<@!?(\d+)>$/, "$1");
  if (!DISCORD_ID_RE.test(id)) {
    errors.discordId = "ID Discord harus berupa angka 15-20 digit";
    return;
  }
  return id;
}

function parseStatus(v: unknown, errors: Fields): MemberStatus | undefined {
  if (typeof v !== "string" || !STATUSES.includes(v)) {
    errors.status = `Status harus salah satu dari: ${STATUSES.join(", ")}`;
    return;
  }
  return v as MemberStatus;
}

function parsePositionId(v: unknown, errors: Fields): number | undefined {
  if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 2147483647) {
    errors.positionId = "Jabatan wajib dipilih";
    return;
  }
  return v;
}

async function assertPositionExists(id: number) {
  const p = await prisma.position.findUnique({ where: { id }, select: { id: true } });
  if (!p) fail({ positionId: "Jabatan tidak ditemukan" });
}

async function assertHexAvailable(hex: string | null, exceptId?: number) {
  if (!hex) return;
  const existing = await prisma.member.findFirst({
    where: { hex, ...(exceptId !== undefined ? { id: { not: exceptId } } : {}) },
    select: { name: true },
  });
  if (existing) {
    throw new ApiError(409, "Validasi gagal", {
      hex: `Steam Hex sudah dipakai oleh "${existing.name}"`,
    });
  }
}

async function assertDiscordIdAvailable(discordId: string | null, exceptId?: number) {
  if (!discordId) return;
  const existing = await prisma.member.findFirst({
    where: { discordId, ...(exceptId !== undefined ? { id: { not: exceptId } } : {}) },
    select: { name: true },
  });
  if (existing) {
    throw new ApiError(409, "Validasi gagal", {
      discordId: `ID Discord sudah dipakai oleh "${existing.name}"`,
    });
  }
}

// ---------- hierarki ----------

type Db = Prisma.TransactionClient | typeof prisma;

/** Jabatan satu tingkat di bawah (demote) atau di atas (promote), null jika sudah di ujung. */
async function adjacentPosition(db: Db, sortOrder: number, direction: "up" | "down") {
  return db.position.findFirst({
    where:
      direction === "down" ? { sortOrder: { gt: sortOrder } } : { sortOrder: { lt: sortOrder } },
    orderBy: { sortOrder: direction === "down" ? "asc" : "desc" },
    select: { id: true },
  });
}

// ---------- query ----------

export type ListParams = {
  search?: string;
  positionId?: number;
  status?: MemberStatus;
  page: number;
  pageSize: number;
};

function buildWhere(p: Pick<ListParams, "search" | "positionId" | "status">): Prisma.MemberWhereInput {
  const search = p.search?.trim();
  return {
    ...(p.positionId !== undefined ? { positionId: p.positionId } : {}),
    ...(p.status ? { status: p.status } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },

            { hex: { contains: search, mode: "insensitive" } },
            { discordId: { contains: search } },
          ],
        }
      : {}),
  };
}

const memberOrder: Prisma.MemberOrderByWithRelationInput[] = [
  { position: { sortOrder: "asc" } },
  { name: "asc" },
];

export function parseListParams(sp: URLSearchParams): ListParams {
  const errors: Fields = {};
  const result: ListParams = { page: 1, pageSize: 20 };

  const search = sp.get("search");
  if (search) result.search = search;

  const pos = sp.get("positionId");
  if (pos) {
    if (!/^\d+$/.test(pos) || Number(pos) > 2147483647) errors.positionId = "positionId tidak valid";
    else result.positionId = Number(pos);
  }

  const status = sp.get("status");
  if (status) {
    if (!STATUSES.includes(status)) errors.status = `status harus salah satu dari: ${STATUSES.join(", ")}`;
    else result.status = status as MemberStatus;
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

export async function listMembers(p: ListParams) {
  const where = buildWhere(p);
  const [total, rows] = await Promise.all([
    prisma.member.count({ where }),
    prisma.member.findMany({
      where,
      include,
      orderBy: memberOrder,
      skip: (p.page - 1) * p.pageSize,
      take: p.pageSize,
    }),
  ]);
  return {
    data: rows.map(serialize),
    meta: { page: p.page, pageSize: p.pageSize, total, totalPages: Math.ceil(total / p.pageSize) },
  };
}

/** Semua jabatan (urut hierarki) beserta anggotanya: Jabatan -> Nama -> Steam -> Hex -> Status. */
export async function listMembersGrouped(p: Pick<ListParams, "search" | "status" | "positionId">) {
  const memberWhere = buildWhere({ search: p.search, status: p.status });
  const positions = await prisma.position.findMany({
    where: p.positionId !== undefined ? { id: p.positionId } : {},
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    include: {
      members: {
        where: memberWhere,
        orderBy: { name: "asc" },
        select: { id: true, name: true, hex: true, discordId: true, status: true },
      },
    },
  });
  return positions.map((pos) => ({
    id: pos.id,
    name: pos.name,
    sortOrder: pos.sortOrder,
    memberCount: pos.members.length,
    members: pos.members,
  }));
}

export async function getMember(id: number) {
  const row = await prisma.member.findUnique({ where: { id }, include });
  if (!row) throw new ApiError(404, "Anggota tidak ditemukan");
  return serialize(row);
}

// ---------- mutasi ----------

export async function createMember(input: Record<string, unknown>) {
  const errors: Fields = {};
  const name = parseName(input.name, errors);
  const positionId = parsePositionId(input.positionId, errors);

  const hex = input.hex === undefined ? null : parseHex(input.hex, errors);
  const discordId =
    input.discordId === undefined ? null : parseDiscordId(input.discordId, errors);
  const status =
    input.status === undefined ? MemberStatus.TIDAK_DIKETAHUI : parseStatus(input.status, errors);
  if (Object.keys(errors).length) fail(errors);

  await assertPositionExists(positionId!);
  await assertHexAvailable(hex ?? null);
  await assertDiscordIdAvailable(discordId ?? null);

  const row = await prisma.member.create({
    data: {
      name: name!,
      positionId: positionId!,

      hex: hex ?? null,
      discordId: discordId ?? null,
      status: status!,
    },
    include,
  });
  return serialize(row);
}

export async function updateMember(id: number, input: Record<string, unknown>) {
  const current = await prisma.member.findUnique({ where: { id }, include });
  if (!current) throw new ApiError(404, "Anggota tidak ditemukan");

  const errors: Fields = {};
  const data: Prisma.MemberUncheckedUpdateInput = {};

  if ("name" in input) data.name = parseName(input.name, errors);

  if ("hex" in input) data.hex = parseHex(input.hex, errors);
  if ("discordId" in input) data.discordId = parseDiscordId(input.discordId, errors);
  if ("status" in input) data.status = parseStatus(input.status, errors);
  if ("positionId" in input) data.positionId = parsePositionId(input.positionId, errors);
  if (Object.keys(errors).length) fail(errors);
  if (Object.keys(data).length === 0) {
    throw new ApiError(400, "Tidak ada field yang diubah");
  }

  if (typeof data.positionId === "number") await assertPositionExists(data.positionId);
  if (typeof data.hex === "string") await assertHexAvailable(data.hex, id);
  if (typeof data.discordId === "string") await assertDiscordIdAvailable(data.discordId, id);

  // Status berubah jadi DITURUNKAN tanpa jabatan dipilih manual -> otomatis turun satu tingkat.
  const becomesDemoted =
    data.status === MemberStatus.DITURUNKAN && current.status !== MemberStatus.DITURUNKAN;
  if (becomesDemoted && !("positionId" in input)) {
    const next = await adjacentPosition(prisma, current.position.sortOrder, "down");
    if (next) data.positionId = next.id;
  }

  const row = await prisma.member.update({ where: { id }, data, include });
  return serialize(row);
}

export async function demoteMember(id: number) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.member.findUnique({ where: { id }, include });
    if (!current) throw new ApiError(404, "Anggota tidak ditemukan");
    const next = await adjacentPosition(tx, current.position.sortOrder, "down");
    if (!next) {
      throw new ApiError(409, `"${current.name}" sudah di jabatan terendah (${current.position.name})`);
    }
    const row = await tx.member.update({
      where: { id },
      data: { positionId: next.id, status: MemberStatus.DITURUNKAN },
      include,
    });
    return { ...serialize(row), previousPosition: current.position.name };
  });
}

export async function promoteMember(id: number) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.member.findUnique({ where: { id }, include });
    if (!current) throw new ApiError(404, "Anggota tidak ditemukan");
    const next = await adjacentPosition(tx, current.position.sortOrder, "up");
    if (!next) {
      throw new ApiError(409, `"${current.name}" sudah di jabatan tertinggi (${current.position.name})`);
    }
    const row = await tx.member.update({
      where: { id },
      data: {
        positionId: next.id,
        ...(current.status === MemberStatus.DITURUNKAN ? { status: MemberStatus.AKTIF } : {}),
      },
      include,
    });
    return { ...serialize(row), previousPosition: current.position.name };
  });
}

export async function deleteMember(id: number) {
  const m = await getMember(id);
  await prisma.member.delete({ where: { id } });
  return { id, name: m.name };
}
