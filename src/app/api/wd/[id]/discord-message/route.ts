import { handleError, parseId, readJson } from "@/lib/errors";
import { setWdDiscordMessage } from "@/lib/wd";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  try {
    const id = parseId((await params).id);
    const body = await readJson(request);
    return Response.json({ data: await setWdDiscordMessage(id, body.messageId) });
  } catch (err) {
    return handleError(err);
  }
}
