import { handleError, parseId, readJson } from "@/lib/errors";
import { markWdLost } from "@/lib/wd";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  try {
    const id = parseId((await params).id);
    return Response.json({ data: await markWdLost(id, await readJson(request)) });
  } catch (err) {
    return handleError(err);
  }
}
