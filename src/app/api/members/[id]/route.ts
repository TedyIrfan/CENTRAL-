import { handleError, parseId, readJson } from "@/lib/errors";
import { deleteMember, getMember, updateMember } from "@/lib/members";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  try {
    const id = parseId((await params).id);
    return Response.json({ data: await getMember(id) });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const id = parseId((await params).id);
    return Response.json({ data: await updateMember(id, await readJson(request)) });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const id = parseId((await params).id);
    return Response.json({ data: await deleteMember(id) });
  } catch (err) {
    return handleError(err);
  }
}
