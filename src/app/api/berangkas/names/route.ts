import { connection } from "next/server";
import { handleError } from "@/lib/errors";
import { vaultNames } from "@/lib/berangkas";

export async function GET() {
  await connection();
  try {
    return Response.json({ data: await vaultNames() });
  } catch (err) {
    return handleError(err);
  }
}
