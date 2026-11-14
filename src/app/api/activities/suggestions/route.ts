import { connection } from "next/server";
import { handleError } from "@/lib/errors";
import { activitySuggestions } from "@/lib/kegiatan";

export async function GET() {
  await connection();
  try {
    return Response.json({ data: await activitySuggestions() });
  } catch (err) {
    return handleError(err);
  }
}
