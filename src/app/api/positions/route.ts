import { handleError, readJson } from "@/lib/errors";
import { createPosition, listPositions } from "@/lib/positions";

export async function GET() {
  try {
    return Response.json({ data: await listPositions() });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const created = await createPosition(body.name);
    return Response.json({ data: created }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
