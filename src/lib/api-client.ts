export class ApiRequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init?.method ?? "GET",
      headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new ApiRequestError("Tidak bisa terhubung ke server", 0);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiRequestError(json?.error ?? "Terjadi kesalahan", res.status, json?.fields);
  }
  return json as T;
}
