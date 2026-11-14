import { handleError, parseId, readJson } from "@/lib/errors";
import { returnWd } from "@/lib/wd";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  try {
    const id = parseId((await params).id);
    return Response.json({ data: await returnWd(id, await readJson(request)) });
  } catch (err) {
    return handleError(err);
  }
}
