import { connection } from "next/server";
import { handleError } from "@/lib/errors";
import { vaultStats } from "@/lib/berangkas";

export async function GET() {
  await connection();
  try {
    return Response.json({ data: await vaultStats() });
  } catch (err) {
    return handleError(err);
  }
}
