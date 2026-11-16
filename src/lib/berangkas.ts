import { Prisma, VaultStatus, type VaultItem as VaultRow } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/errors";

const STATUSES = Object.values(VaultStatus) as string[];

type Fields = Record<string, string>;

function fail(fields: Fields): never {
  throw new ApiError(422, "Validasi gagal", fields);
}

// ---------- validasi ----------

function parseName(v: unknown, errors: Fields): string | undefined {
  if (typeof v !== "string" || v.trim() === "") {
    errors.name = "Nama barang wajib diisi";
    return;
  }
  const name = v.trim().replace(/\s+/g, " ");
  if (name.length < 2) {
    errors.name = "Nama barang minimal 2 karakter";
    return;
  }
  if (name.length > 100) {
    errors.name = "Nama barang maksimal 100 karakter";
    return;
  }
  return name;
}

function parseSerial(v: unknown, required: boolean, errors: Fields): string | null | undefined {
  if (v === null || v === undefined || (typeof v === "string" && v.trim() === "")) {
    if (required) errors.serialNumber = "SN wajib diisi untuk senjata";
    return null;
  }
  if (typeof v !== "string") {
    errors.serialNumber = "SN harus berupa teks";
    return;
  }
  const serial = v.trim();
  if (serial.length > 100) {
    errors.serialNumber = "SN maksimal 100 karakter";
    return;
  }
  return serial;
}

function parseDurability(v: unknown, errors: Fields): number | null | undefined {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 100) {
    errors.durability = "Durab harus bilangan bulat 0-100";
    return;
  }
  return v;
}

function parseStatus(v: unknown, errors: Fields): VaultStatus | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string" || !STATUSES.includes(v)) {
    errors.status = `Status harus salah satu dari: ${STATUSES.join(", ")}`;
    return;
  }
  return v as VaultStatus;
}

function parseNote(v: unknown, errors: Fields): string | null | undefined {
  if (v === null || v === undefined || (typeof v === "string" && v.trim() === "")) return null;
  if (typeof v !== "string") {
    errors.note = "Catatan harus berupa teks";
    return;
  }
  const note = v.trim();
  if (note.length > 500) {
    errors.note = "Catatan maksimal 500 karakter";
    return;
  }
  return note;
}

function parseWeapon(v: unknown): boolean {
  return v === undefined ? true : v === true;
}

async function assertSerialFree(serial: string, exceptId?: number) {
  const existing = await prisma.vaultItem.findFirst({
    where: {
      serialNumber: { equals: serial, mode: "insensitive" },
      ...(exceptId !== undefined ? { id: { not: exceptId } } : {}),
    },
    select: { id: true, name: true },
  });
  if (existing) {
    throw new ApiError(409, "Validasi gagal", {
      serialNumber: `SN sudah ada di Berangkas (${existing.name})`,
    });
  }
}

// ---------- query ----------

export type VaultListParams = {
  search?: string;
  status?: string;
  name?: string;
  page: number;
  pageSize: number;
};

export function parseVaultListParams(sp: URLSearchParams): VaultListParams {
  const errors: Fields = {};
  const result: VaultListParams = { page: 1, pageSize: 20 };

  const search = sp.get("search");
  if (search?.trim()) result.search = search.trim();

  const name = sp.get("name");
  if (name?.trim()) result.name = name.trim();

  const status = sp.get("status");
  if (status) {
    if (!STATUSES.includes(status)) errors.status = `status harus salah satu dari: ${STATUSES.join(", ")}`;
    else result.status = status;
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

function buildWhere(p: Pick<VaultListParams, "search" | "status" | "name">) {
  const where: Prisma.VaultItemWhereInput = {};
  if (p.status) where.status = p.status as VaultStatus;
  if (p.name) where.name = { contains: p.name, mode: "insensitive" };
  if (p.search) {
    where.OR = [
      { name: { contains: p.search, mode: "insensitive" } },
      { serialNumber: { contains: p.search, mode: "insensitive" } },
      { note: { contains: p.search, mode: "insensitive" } },
    ];
  }
  return where;
}

function serialize(r: VaultRow) {
  return {
    id: r.id,
    name: r.name,
    serialNumber: r.serialNumber,
    isWeapon: r.isWeapon,
    durability: r.durability,
    status: r.status,
    note: r.note,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export async function listVault(p: VaultListParams) {
  const where = buildWhere(p);
  const [total, rows] = await Promise.all([
    prisma.vaultItem.count({ where }),
    prisma.vaultItem.findMany({
      where,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: (p.page - 1) * p.pageSize,
      take: p.pageSize,
    }),
  ]);
  return {
    data: rows.map(serialize),
    meta: { page: p.page, pageSize: p.pageSize, total, totalPages: Math.ceil(total / p.pageSize) },
  };
}

export async function vaultStats() {
  const grouped = await prisma.vaultItem.groupBy({ by: ["status"], _count: { _all: true } });
  const counts = Object.fromEntries(Object.values(VaultStatus).map((s) => [s, 0])) as Record<VaultStatus, number>;
  for (const g of grouped) counts[g.status] = g._count._all;
  return {
    total: grouped.reduce((n, g) => n + g._count._all, 0),
    siap: counts.SIAP,
    dipinjam: counts.DIPINJAM,
    hilang: counts.HILANG,
    rusak: counts.RUSAK,
  };
}

export async function vaultNames() {
  const rows = await prisma.vaultItem.findMany({
    distinct: ["name"],
    orderBy: { name: "asc" },
    select: { name: true },
  });
  return rows.map((r) => r.name);
}

export async function getVault(id: number) {
  const row = await prisma.vaultItem.findUnique({ where: { id } });
  if (!row) throw new ApiError(404, "Barang Berangkas tidak ditemukan");
  return serialize(row);
}

// ---------- mutasi ----------

export async function createVault(input: Record<string, unknown>) {
  const errors: Fields = {};
  const name = parseName(input.name, errors);
  const isWeapon = parseWeapon(input.isWeapon);
  const serialNumber = parseSerial(input.serialNumber, isWeapon, errors);
  const durability = parseDurability(input.durability, errors);
  const status = parseStatus(input.status, errors) ?? VaultStatus.SIAP;
  const note = parseNote(input.note, errors);
  if (Object.keys(errors).length) fail(errors);

  if (serialNumber) await assertSerialFree(serialNumber);

  const row = await prisma.vaultItem.create({
    data: { name: name!, isWeapon, serialNumber, durability, status, note },
  });
  return serialize(row);
}

export async function updateVault(id: number, input: Record<string, unknown>) {
  const current = await prisma.vaultItem.findUnique({ where: { id } });
  if (!current) throw new ApiError(404, "Barang Berangkas tidak ditemukan");

  const errors: Fields = {};
  const data: Prisma.VaultItemUncheckedUpdateInput = {};

  if ("name" in input) data.name = parseName(input.name, errors);

  const isWeapon = "isWeapon" in input ? input.isWeapon === true : current.isWeapon;
  if ("isWeapon" in input) data.isWeapon = isWeapon;

  if ("serialNumber" in input || "isWeapon" in input) {
    const serial = parseSerial(input.serialNumber ?? current.serialNumber, isWeapon, errors);
    if (serial && serial !== current.serialNumber) await assertSerialFree(serial, id);
    data.serialNumber = serial;
  }

  if ("durability" in input) data.durability = parseDurability(input.durability, errors);
  if ("status" in input) data.status = parseStatus(input.status, errors);
  if ("note" in input) data.note = parseNote(input.note, errors);

  if (Object.keys(errors).length) fail(errors);
  if (Object.keys(data).length === 0) throw new ApiError(400, "Tidak ada field yang diubah");

  const row = await prisma.vaultItem.update({ where: { id }, data });
  return serialize(row);
}

export async function deleteVault(id: number) {
  const row = await prisma.vaultItem.findUnique({ where: { id }, select: { name: true, serialNumber: true } });
  if (!row) throw new ApiError(404, "Barang Berangkas tidak ditemukan");
  await prisma.vaultItem.delete({ where: { id } });
  return { id, name: row.name, serialNumber: row.serialNumber };
}
