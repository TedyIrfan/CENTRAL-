import { handleError, parseId } from "@/lib/errors";
import { markWdReminder } from "@/lib/wd";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Ctx) {
  try {
    const id = parseId((await params).id);
    return Response.json({ data: await markWdReminder(id) });
  } catch (err) {
    return handleError(err);
  }
}
