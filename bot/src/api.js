const BASE = process.env.API_URL ?? "http://localhost:3001";

export class ApiError extends Error {
  constructor(message, status, fields) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

/** Kesalahan yang pesannya aman ditampilkan langsung ke pengguna Discord. */
export class UserError extends Error {}

export async function api(path, { method = "GET", body } = {}) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new ApiError("Tidak bisa terhubung ke API Central T", 0);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(json?.error ?? "Terjadi kesalahan", res.status, json?.fields);
  return json;
}

export function describeError(err) {
  if (err instanceof ApiError) {
    const detail = err.fields ? Object.values(err.fields).join("; ") : "";
    return detail ? `${err.message}: ${detail}` : err.message;
  }
  console.error(err);
  return "Terjadi kesalahan tak terduga";
}
