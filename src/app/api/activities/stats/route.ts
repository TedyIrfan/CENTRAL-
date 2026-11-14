import { connection } from "next/server";
import { handleError } from "@/lib/errors";
import { activityStats } from "@/lib/kegiatan";

export async function GET() {
  await connection();
  try {
    return Response.json({ data: await activityStats() });
  } catch (err) {
    return handleError(err);
  }
}
