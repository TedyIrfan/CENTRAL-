import { actorFromRequest } from "@/lib/audit";
import { demoteMember } from "@/lib/members";
import { handleError, parseId } from "@/lib/errors";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = parseId((await params).id);
    return Response.json({ data: await demoteMember(id, actorFromRequest(request)) });
  } catch (err) {
    return handleError(err);
  }
}
