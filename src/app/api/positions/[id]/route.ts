import { handleError, parseId, readJson } from "@/lib/errors";
import { deletePosition, getPosition, updatePosition } from "@/lib/positions";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  try {
    const id = parseId((await params).id);
    return Response.json({ data: await getPosition(id) });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const id = parseId((await params).id);
    const body = await readJson(request);
    return Response.json({ data: await updatePosition(id, body.name) });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const id = parseId((await params).id);
    return Response.json({ data: await deletePosition(id) });
  } catch (err) {
    return handleError(err);
  }
}
