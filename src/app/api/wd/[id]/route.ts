import { handleError, parseId, readJson } from "@/lib/errors";
import { deleteWd, getWd, updateWd } from "@/lib/wd";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  try {
    const id = parseId((await params).id);
    return Response.json({ data: await getWd(id) });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const id = parseId((await params).id);
    return Response.json({ data: await updateWd(id, await readJson(request)) });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const id = parseId((await params).id);
    return Response.json({ data: await deleteWd(id) });
  } catch (err) {
    return handleError(err);
  }
}
