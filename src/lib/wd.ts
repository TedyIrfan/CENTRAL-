import { Prisma, WdStatus, type WdRecord as WdRow } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/errors";
import { compactDate, parseDateInput, startOfMonthWib, todayWib } from "@/lib/dates";

const STATUSES = Object.values(WdStatus) as string[];

type Fields = Record<string, string>;

function fail(fields: Fields): never {
  throw new ApiError(422, "Validasi gagal", fields);
}

// ---------- validasi ----------

function parseMemberId(v: unknown, errors: Fields): number | undefined {
  if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 2147483647) {
    errors.memberId = "Anggota wajib dipilih";
    return;
  }
  return v;
}

function parseItemName(v: unknown, errors: Fields): string | undefined {
  if (typeof v !== "string" || v.trim() === "") {
    errors.itemName = "Jenis barang wajib diisi";
    return;
  }
  const name = v.trim().replace(/\s+/g, " ");
  if (name.length < 2) {
    errors.itemName = "Jenis barang minimal 2 karakter";
    return;
  }
  if (name.length > 100) {
    errors.itemName = "Jenis barang maksimal 100 karakter";
    return;
  }
  return name;
}

function parseSerial(v: unknown, required: boolean, errors: Fields): string | null | undefined {
  if (v === null || (typeof v === "string" && v.trim() === "")) {
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

function parseQty(v: unknown, errors: Fields): number | undefined {
  if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 10000) {
    errors.qty = "Qty harus bilangan bulat 1-10.000";
    return;
  }
  return v;
}

function parseDurability(
  v: unknown,
  label: string,
  key: string,
  required: boolean,
  errors: Fields,
): number | null | undefined {
  if (v === undefined || v === null || v === "") {
    if (required) errors[key] = `${label} wajib diisi untuk senjata`;
    return null;
  }
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 100) {
    errors[key] = `${label} harus bilangan bulat 0-100`;
    return;
  }
  return v;
}

function parsePurpose(v: unknown, errors: Fields): string | undefined {
  if (typeof v !== "string" || v.trim() === "") {
    errors.purpose = "Keperluan wajib diisi";
    return;
  }
  const purpose = v.trim();
  if (purpose.length < 3) {
    errors.purpose = "Keperluan minimal 3 karakter";
    return;
  }
  if (purpose.length > 500) {
    errors.purpose = "Keperluan maksimal 500 karakter";
    return;
  }
  return purpose;
}

function parseOptionalText(
  v: unknown,
  label: string,
  max: number,
  min: number,
  key: string,
  errors: Fields,
): string | null | undefined {
  if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) return null;
  if (typeof v !== "string") {
    errors[key] = `${label} harus berupa teks`;
    return;
  }
  const text = v.trim();
  if (text.length < min) {
    errors[key] = `${label} minimal ${min} karakter`;
    return;
  }
  if (text.length > max) {
    errors[key] = `${label} maksimal ${max} karakter`;
    return;
  }
  return text;
}

function parseDateField(
  v: unknown,
  label: string,
  key: string,
  errors: Fields,
  required = false,
): Date | undefined {
  if (v === undefined || v === null || v === "") {
    if (required) errors[key] = `${label} wajib diisi`;
    return;
  }
  const date = parseDateInput(v);
  if (!date) {
    errors[key] = `${label} tidak valid (format YYYY-MM-DD)`;
    return;
  }
  return date;
}

function todayDate(): Date {
  return parseDateInput(todayWib())!;
}

// ---------- helper ----------

async function assertSerialFree(
  serial: string,
  exceptId?: number,
  db: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const existing = await db.wdRecord.findFirst({
    where: {
      serialNumber: { equals: serial, mode: "insensitive" },
      status: WdStatus.DIPINJAM,
      ...(exceptId !== undefined ? { id: { not: exceptId } } : {}),
    },
    select: { code: true, borrowerName: true },
  });
  if (existing) {
    throw new ApiError(409, "Validasi gagal", {
      serialNumber: `SN masih dipinjam oleh ${existing.borrowerName} (${existing.code})`,
    });
  }
}

async function nextCode(db: Prisma.TransactionClient, date: Date) {
  const prefix = `WD-${compactDate(date)}-`;
  const last = await db.wdRecord.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  const next = last ? Number(last.code.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}

function serialize(r: WdRow) {
  return {
    id: r.id,
    code: r.code,
    memberId: r.memberId,
    borrowerName: r.borrowerName,
    itemName: r.itemName,
    isWeapon: r.isWeapon,
    serialNumber: r.serialNumber,
    qty: r.qty,
    durabilityStart: r.durabilityStart,
    durabilityReturn: r.durabilityReturn,
    takenAt: r.takenAt.toISOString(),
    returnedAt: r.returnedAt?.toISOString() ?? null,
    purpose: r.purpose,
    returnNote: r.returnNote,
    lostReason: r.lostReason,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

// ---------- query ----------

export type WdListParams = {
  status?: string;
  search?: string;
  itemName?: string;
  from?: Date;
  to?: Date;
  page: number;
  pageSize: number;
};

export function parseWdListParams(sp: URLSearchParams): WdListParams {
  const errors: Fields = {};
  const result: WdListParams = { page: 1, pageSize: 20 };

  const status = sp.get("status");
  if (status) {
    if (!STATUSES.includes(status)) errors.status = `status harus salah satu dari: ${STATUSES.join(", ")}`;
    else result.status = status;
  }

  const search = sp.get("search");
  if (search?.trim()) result.search = search.trim();

  const itemName = sp.get("item");
  if (itemName?.trim()) result.itemName = itemName.trim();

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

  if (result.from && result.to && result.from > result.to) errors.to = "Tanggal akhir harus setelah tanggal awal";

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

function buildWhere(p: Pick<WdListParams, "status" | "search" | "itemName" | "from" | "to">) {
  const where: Prisma.WdRecordWhereInput = {};
  if (p.status) where.status = p.status as WdStatus;
  if (p.itemName) where.itemName = { contains: p.itemName, mode: "insensitive" };
  if (p.from || p.to) {
    where.takenAt = {
      ...(p.from ? { gte: p.from } : {}),
      ...(p.to ? { lte: p.to } : {}),
    };
  }
  if (p.search) {
    where.OR = [
      { code: { contains: p.search, mode: "insensitive" } },
      { borrowerName: { contains: p.search, mode: "insensitive" } },
      { itemName: { contains: p.search, mode: "insensitive" } },
      { serialNumber: { contains: p.search, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function listWd(p: WdListParams) {
  const where = buildWhere(p);
  const [total, rows] = await Promise.all([
    prisma.wdRecord.count({ where }),
    prisma.wdRecord.findMany({
      where,
      orderBy: [{ takenAt: "desc" }, { id: "desc" }],
      skip: (p.page - 1) * p.pageSize,
      take: p.pageSize,
    }),
  ]);
  return {
    data: rows.map(serialize),
    meta: { page: p.page, pageSize: p.pageSize, total, totalPages: Math.ceil(total / p.pageSize) },
  };
}

export async function getWd(id: number) {
  const row = await prisma.wdRecord.findUnique({ where: { id } });
  if (!row) throw new ApiError(404, "Transaksi WD tidak ditemukan");
  return serialize(row);
}

export async function wdStats() {
  const monthStart = startOfMonthWib();
  const [total, dipinjam, hilang, kembaliBulanIni] = await Promise.all([
    prisma.wdRecord.count(),
    prisma.wdRecord.count({ where: { status: WdStatus.DIPINJAM } }),
    prisma.wdRecord.count({ where: { status: WdStatus.HILANG } }),
    prisma.wdRecord.count({
      where: { status: WdStatus.DIKEMBALIKAN, returnedAt: { gte: monthStart } },
    }),
  ]);
  return { total, dipinjam, kembaliBulanIni, hilang };
}

export async function itemSuggestions() {
  const rows = await prisma.wdRecord.groupBy({
    by: ["itemName"],
    _max: { createdAt: true },
    orderBy: { _max: { createdAt: "desc" } },
    take: 30,
  });
  return rows.map((r) => r.itemName);
}

// ---------- mutasi ----------

export async function createWd(input: Record<string, unknown>) {
  const errors: Fields = {};
  const memberId = parseMemberId(input.memberId, errors);
  const itemName = parseItemName(input.itemName, errors);
  const isWeapon = input.isWeapon === true;
  const qty = parseQty(input.qty ?? 1, errors);
  const serialNumber = isWeapon ? parseSerial(input.serialNumber, true, errors) : null;
  const durabilityStart = isWeapon
    ? parseDurability(input.durabilityStart, "Durab awal", "durabilityStart", true, errors)
    : null;
  const takenAt = parseDateField(input.takenAt, "Tanggal pengambilan", "takenAt", errors) ?? todayDate();
  const purpose = parsePurpose(input.purpose, errors);
  if (Object.keys(errors).length) fail(errors);

  const member = await prisma.member.findUnique({
    where: { id: memberId! },
    select: { id: true, name: true },
  });
  if (!member) fail({ memberId: "Anggota tidak ditemukan" });
  if (serialNumber) await assertSerialFree(serialNumber);

  return prisma.$transaction(async (tx) => {
    const row = await tx.wdRecord.create({
      data: {
        code: await nextCode(tx, takenAt),
        memberId: member!.id,
        borrowerName: `CT - ${member!.name}`,
        itemName: itemName!,
        isWeapon,
        serialNumber,
        qty: qty!,
        durabilityStart,
        takenAt,
        purpose: purpose!,
        createdBy: "web",
      },
    });
    return serialize(row);
  });
}

export async function updateWd(id: number, input: Record<string, unknown>) {
  const current = await prisma.wdRecord.findUnique({ where: { id } });
  if (!current) throw new ApiError(404, "Transaksi WD tidak ditemukan");
  if (current.status !== WdStatus.DIPINJAM) {
    throw new ApiError(409, "Hanya transaksi yang masih dipinjam yang bisa diubah");
  }

  const errors: Fields = {};
  const data: Prisma.WdRecordUncheckedUpdateInput = {};

  if ("memberId" in input) {
    const memberId = parseMemberId(input.memberId, errors);
    if (memberId !== undefined) {
      const member = await prisma.member.findUnique({
        where: { id: memberId },
        select: { name: true },
      });
      if (!member) fail({ memberId: "Anggota tidak ditemukan" });
      data.memberId = memberId;
      data.borrowerName = `CT - ${member!.name}`;
    }
  }

  if ("itemName" in input) data.itemName = parseItemName(input.itemName, errors);

  const isWeapon = "isWeapon" in input ? input.isWeapon === true : current.isWeapon;
  if ("isWeapon" in input) data.isWeapon = isWeapon;

  if ("serialNumber" in input || "isWeapon" in input) {
    if (isWeapon) {
      const serial = parseSerial(input.serialNumber ?? current.serialNumber, true, errors);
      if (serial && serial !== current.serialNumber) await assertSerialFree(serial, id);
      data.serialNumber = serial;
    } else {
      data.serialNumber = null;
    }
  }

  if ("durabilityStart" in input || "isWeapon" in input) {
    if (isWeapon) {
      data.durabilityStart = parseDurability(
        input.durabilityStart ?? current.durabilityStart,
        "Durab awal",
        "durabilityStart",
        true,
        errors,
      );
    } else {
      data.durabilityStart = null;
    }
  }

  if ("qty" in input) data.qty = parseQty(input.qty, errors);
  if ("takenAt" in input) data.takenAt = parseDateField(input.takenAt, "Tanggal pengambilan", "takenAt", errors, true);
  if ("purpose" in input) data.purpose = parsePurpose(input.purpose, errors);

  if (Object.keys(errors).length) fail(errors);
  if (Object.keys(data).length === 0) throw new ApiError(400, "Tidak ada field yang diubah");

  const row = await prisma.wdRecord.update({ where: { id }, data });
  return serialize(row);
}

export async function returnWd(id: number, input: Record<string, unknown>) {
  const current = await prisma.wdRecord.findUnique({ where: { id } });
  if (!current) throw new ApiError(404, "Transaksi WD tidak ditemukan");
  if (current.status !== WdStatus.DIPINJAM) {
    throw new ApiError(409, "Transaksi ini sudah dikembalikan atau ditandai hilang");
  }

  const errors: Fields = {};
  const returnedAt =
    parseDateField(input.returnedAt, "Tanggal pengembalian", "returnedAt", errors) ?? todayDate();

  if (returnedAt < current.takenAt) {
    errors.returnedAt = "Tanggal kembali tidak boleh sebelum tanggal ambil";
  }

  let durabilityReturn: number | null = null;
  if (current.isWeapon) {
    durabilityReturn = parseDurability(
      input.durabilityReturn,
      "Durab dikembalikan",
      "durabilityReturn",
      true,
      errors,
    ) ?? null;
    if (
      durabilityReturn !== null &&
      current.durabilityStart !== null &&
      durabilityReturn > current.durabilityStart
    ) {
      errors.durabilityReturn = "Durab kembali tidak boleh lebih besar dari durab awal";
    }
  }

  const returnNote = parseOptionalText(
    input.returnNote,
    "Catatan kondisi",
    500,
    0,
    "returnNote",
    errors,
  );
  if (Object.keys(errors).length) fail(errors);

  const row = await prisma.wdRecord.update({
    where: { id },
    data: {
      status: WdStatus.DIKEMBALIKAN,
      returnedAt,
      durabilityReturn,
      returnNote,
      returnedBy: "web",
    },
  });
  return serialize(row);
}

export async function markWdLost(id: number, input: Record<string, unknown>) {
  const current = await prisma.wdRecord.findUnique({ where: { id } });
  if (!current) throw new ApiError(404, "Transaksi WD tidak ditemukan");
  if (current.status !== WdStatus.DIPINJAM) {
    throw new ApiError(409, "Hanya transaksi yang masih dipinjam yang bisa ditandai hilang");
  }

  const errors: Fields = {};
  const lostReason = parseOptionalText(input.lostReason, "Alasan hilang", 500, 3, "lostReason", errors);
  if (!lostReason && !errors.lostReason) errors.lostReason = "Alasan hilang wajib diisi";
  if (Object.keys(errors).length) fail(errors);

  const row = await prisma.wdRecord.update({
    where: { id },
    data: { status: WdStatus.HILANG, lostReason },
  });
  return serialize(row);
}

export async function deleteWd(id: number) {
  const row = await prisma.wdRecord.findUnique({ where: { id }, select: { code: true } });
  if (!row) throw new ApiError(404, "Transaksi WD tidak ditemukan");
  await prisma.wdRecord.delete({ where: { id } });
  return { id, code: row.code };
}
