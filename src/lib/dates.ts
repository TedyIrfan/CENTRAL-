export const WIB_TZ = "Asia/Jakarta";

/** Tanggal hari ini (WIB) dalam format YYYY-MM-DD. */
export function todayWib(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: WIB_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Awal bulan berjalan (WIB) sebagai Date UTC tengah malam. */
export function startOfMonthWib(): Date {
  const [y, m] = todayWib().split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1));
}

/** ISO / Date -> DD/MM/YYYY (berbasis tanggal, bukan jam). */
export function formatDateId(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const iso = typeof value === "string" ? value : value.toISOString();
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return "—";
  return `${d}/${m}/${y}`;
}

/** "YYYY-MM-DD" -> Date UTC tengah malam, null jika tidak valid. */
export function parseDateInput(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return date;
}

/** ISO / Date -> YYYY-MM-DD untuk <input type="date">. */
export function toDateInput(value: string | Date | null | undefined): string {
  if (!value) return "";
  const iso = typeof value === "string" ? value : value.toISOString();
  return iso.slice(0, 10);
}

/** YYYY-MM-DD hasil Date UTC (untuk kode transaksi). */
export function compactDate(value: Date): string {
  return value.toISOString().slice(0, 10).replaceAll("-", "");
}
