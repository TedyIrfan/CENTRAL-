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

/** Tambah sejumlah hari kalender. */
export function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * 86_400_000);
}

/** YYYY-MM-DD + N hari -> YYYY-MM-DD ("" kalau input tidak valid). */
export function addDaysIso(value: string, days: number): string {
  const date = parseDateInput(value);
  if (!date) return "";
  return toDateInput(addDays(date, days));
}

/** Selisih hari kalender (later - earlier), minimal 0. */
export function daysBetween(
  later: string | Date | null | undefined,
  earlier: string | Date | null | undefined,
): number {
  const a = asUtcDate(later);
  const b = asUtcDate(earlier);
  if (!a || !b) return 0;
  return Math.max(0, Math.round((a.getTime() - b.getTime()) / 86_400_000));
}

function asUtcDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return parseDateInput(value.toISOString().slice(0, 10));
  return parseDateInput(String(value).slice(0, 10));
}
