import { handleError, parseId, readJson } from "@/lib/errors";
import { deleteActivity, getActivity, updateActivity } from "@/lib/kegiatan";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  try {
    const id = parseId((await params).id);
    return Response.json({ data: await getActivity(id) });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const id = parseId((await params).id);
    return Response.json({ data: await updateActivity(id, await readJson(request)) });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const id = parseId((await params).id);
    return Response.json({ data: await deleteActivity(id) });
  } catch (err) {
    return handleError(err);
  }
}
