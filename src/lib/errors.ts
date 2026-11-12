import { Prisma } from "@prisma/client";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export function handleError(err: unknown): Response {
  if (err instanceof ApiError) {
    return Response.json(
      { error: err.message, ...(err.fields ? { fields: err.fields } : {}) },
      { status: err.status },
    );
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2025") {
      return Response.json({ error: "Data tidak ditemukan" }, { status: 404 });
    }
    if (err.code === "P2002") {
      return Response.json({ error: "Data sudah ada" }, { status: 409 });
    }
  }
  console.error(err);
  return Response.json({ error: "Terjadi kesalahan server" }, { status: 500 });
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (body && typeof body === "object" && !Array.isArray(body)) {
      return body as Record<string, unknown>;
    }
  } catch {
    // fall through
  }
  throw new ApiError(400, "Body harus berupa JSON object");
}

export function parseId(raw: string): number {
  if (!/^\d+$/.test(raw)) throw new ApiError(400, "ID tidak valid");
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id > 2147483647) {
    throw new ApiError(400, "ID tidak valid");
  }
  return id;
}
