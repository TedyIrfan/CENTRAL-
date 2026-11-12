import type { NextRequest } from "next/server";
import { handleError } from "@/lib/errors";
import { listMembersGrouped, parseListParams } from "@/lib/members";

export async function GET(request: NextRequest) {
  try {
    const { search, status, positionId } = parseListParams(request.nextUrl.searchParams);
    return Response.json({ data: await listMembersGrouped({ search, status, positionId }) });
  } catch (err) {
    return handleError(err);
  }
}
