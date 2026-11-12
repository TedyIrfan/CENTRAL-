import type { NextRequest } from "next/server";
import { handleError, readJson } from "@/lib/errors";
import { createMember, listMembers, parseListParams } from "@/lib/members";

export async function GET(request: NextRequest) {
  try {
    const result = await listMembers(parseListParams(request.nextUrl.searchParams));
    return Response.json(result);
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: Request) {
  try {
    const created = await createMember(await readJson(request));
    return Response.json({ data: created }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
