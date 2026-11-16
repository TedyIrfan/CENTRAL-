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

/**
 * Identitas pelaku untuk jejak audit di web.
 * `displayName` dipakai kalau ada (nick di server), kalau tidak pakai nama global/username.
 */
export function actorOf(user, displayName) {
  if (!user) return null;
  return {
    id: user.id ? String(user.id) : null,
    name: displayName ?? user.globalName ?? user.username ?? (user.id ? String(user.id) : null),
  };
}

export async function api(path, { method = "GET", body, actor } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  // Dibaca di server (src/lib/audit.ts) untuk mengisi "siapa yang mengubah".
  if (actor) {
    headers["x-actor-source"] = "discord";
    if (actor.id) headers["x-actor-id"] = String(actor.id);
    if (actor.name) headers["x-actor-name"] = encodeURIComponent(String(actor.name));
  }

  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: Object.keys(headers).length ? headers : undefined,
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
