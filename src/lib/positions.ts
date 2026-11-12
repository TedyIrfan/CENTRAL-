import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/errors";

const MAX_NAME = 100;

function validateName(input: unknown): string {
  if (typeof input !== "string" || input.trim() === "") {
    throw new ApiError(422, "Validasi gagal", { name: "Nama jabatan wajib diisi" });
  }
  const name = input.trim().replace(/\s+/g, " ");
  if (name.length > MAX_NAME) {
    throw new ApiError(422, "Validasi gagal", {
      name: `Nama jabatan maksimal ${MAX_NAME} karakter`,
    });
  }
  return name;
}

async function assertNameAvailable(name: string, exceptId?: number) {
  const existing = await prisma.position.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      ...(exceptId !== undefined ? { id: { not: exceptId } } : {}),
    },
    select: { id: true },
  });
  if (existing) {
    throw new ApiError(409, "Validasi gagal", { name: "Nama jabatan sudah ada" });
  }
}

const withCount = { _count: { select: { members: true } } } as const;

function serialize(p: {
  id: number;
  name: string;
  sortOrder: number;
  createdAt: Date;
  _count: { members: number };
}) {
  return {
    id: p.id,
    name: p.name,
    sortOrder: p.sortOrder,
    createdAt: p.createdAt,
    memberCount: p._count.members,
  };
}

export async function listPositions() {
  const rows = await prisma.position.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    include: withCount,
  });
  return rows.map(serialize);
}

export async function getPosition(id: number) {
  const row = await prisma.position.findUnique({ where: { id }, include: withCount });
  if (!row) throw new ApiError(404, "Jabatan tidak ditemukan");
  return serialize(row);
}

export async function createPosition(input: unknown) {
  const name = validateName(input);
  await assertNameAvailable(name);
  const last = await prisma.position.aggregate({ _max: { sortOrder: true } });
  const row = await prisma.position.create({
    data: { name, sortOrder: (last._max.sortOrder ?? 0) + 1 },
    include: withCount,
  });
  return serialize(row);
}

export async function updatePosition(id: number, input: unknown) {
  const name = validateName(input);
  await getPosition(id);
  await assertNameAvailable(name, id);
  const row = await prisma.position.update({
    where: { id },
    data: { name },
    include: withCount,
  });
  return serialize(row);
}

export async function deletePosition(id: number) {
  const position = await getPosition(id);
  if (position.memberCount > 0) {
    throw new ApiError(
      409,
      `Jabatan "${position.name}" masih dipakai ${position.memberCount} anggota. Pindahkan anggotanya dulu.`,
    );
  }
  await prisma.position.delete({ where: { id } });
  return { id, name: position.name };
}
