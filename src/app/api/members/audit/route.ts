import type { NextRequest } from "next/server";
import { listMemberAudits } from "@/lib/audit";
import { handleError } from "@/lib/errors";

/** GET /api/members/audit?memberId=1&search=nama&pageSize=50 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const rawId = sp.get("memberId");
    const rawSize = sp.get("pageSize");
    return Response.json(
      await listMemberAudits({
        memberId: rawId && /^\d+$/.test(rawId) ? Number(rawId) : undefined,
        search: sp.get("search")?.trim() || undefined,
        pageSize: rawSize && /^\d+$/.test(rawSize) ? Number(rawSize) : undefined,
      }),
    );
  } catch (err) {
    return handleError(err);
  }
}
