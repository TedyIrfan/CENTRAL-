import { handleError, parseId } from "@/lib/errors";
import { promoteMember } from "@/lib/members";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = parseId((await params).id);
    return Response.json({ data: await promoteMember(id) });
  } catch (err) {
    return handleError(err);
  }
}
