import { handleError, parseId, readJson } from "@/lib/errors";
import { deleteVault, getVault, updateVault } from "@/lib/berangkas";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  try {
    const id = parseId((await params).id);
    return Response.json({ data: await getVault(id) });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const id = parseId((await params).id);
    return Response.json({ data: await updateVault(id, await readJson(request)) });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const id = parseId((await params).id);
    return Response.json({ data: await deleteVault(id) });
  } catch (err) {
    return handleError(err);
  }
}
