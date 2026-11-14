import { connection } from "next/server";
import { handleError } from "@/lib/errors";
import { itemSuggestions } from "@/lib/wd";

export async function GET() {
  await connection();
  try {
    return Response.json({ data: await itemSuggestions() });
  } catch (err) {
    return handleError(err);
  }
}
