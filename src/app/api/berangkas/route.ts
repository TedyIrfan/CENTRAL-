import type { NextRequest } from "next/server";
import { connection } from "next/server";
import { handleError, readJson } from "@/lib/errors";
import { createVault, listVault, parseVaultListParams } from "@/lib/berangkas";

export async function GET(request: NextRequest) {
  await connection();
  try {
    const result = await listVault(parseVaultListParams(request.nextUrl.searchParams));
    return Response.json(result);
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: Request) {
  try {
    const created = await createVault(await readJson(request));
    return Response.json({ data: created }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
