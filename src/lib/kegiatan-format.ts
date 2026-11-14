import { formatDateId } from "@/lib/dates";
import type { Activity } from "@/lib/types";

const row = (label: string, value: string) =>
  value === "" ? `${label.padEnd(16)}:` : `${label.padEnd(16)}: ${value}`;

/** Format baku kegiatan — dipakai untuk tampilan detail & tombol salin. */
export function formatActivityText(a: Activity): string {
  return [
    "NAMA ANGGOTA YANG IKUT KEGIATAN",
    "",
    row("TANGGAL KEGIATAN", formatDateId(a.activityDate)),
    row("KEGIATAN", a.title),
    row("NEGOSIASI", a.negotiation?.trim() ? a.negotiation : "—"),
    row("NAMA ANGGOTA", ""),
    ...a.participants.map((p, i) => `${String(i + 1).padStart(2, " ")}. ${p.name}`),
  ].join("\n");
}
