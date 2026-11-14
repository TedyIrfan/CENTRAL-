import { formatDateId } from "@/lib/dates";
import type { WdRecord } from "@/lib/types";

const durab = (v: number | null) => (v === null ? "—" : `${v} %`);

/** Format baku WD — dipakai untuk tampilan detail & tombol salin. */
export function formatWdText(w: WdRecord): string {
  return [
    "FORMAT PENGAMBILAN & PENGEMBALIAN BARANG",
    `TGL PENGAMBILAN   : ${formatDateId(w.takenAt)}`,
    `TGL PENGEMBALIAN  : ${formatDateId(w.returnedAt)}`,
    `NAMA              : ${w.borrowerName}`,
    `JENIS BARANG      : ${w.itemName}`,
    `SN                : ${w.serialNumber ?? "—"}`,
    `DURAB AWAL        : ${durab(w.durabilityStart)}`,
    `DURAB DIKEMBALIKAN: ${durab(w.durabilityReturn)}`,
    `QTY               : ${w.qty} PCS`,
    `KEPERLUAN         : ${w.purpose}`,
  ].join("\n");
}
