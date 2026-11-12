export const STATUS = {
  AKTIF: { label: "Aktif", emoji: "🟢" },
  TIDAK_AKTIF: { label: "Tidak Aktif", emoji: "⚫" },
  DITURUNKAN: { label: "Diturunkan", emoji: "🔴" },
  TIDAK_DIKETAHUI: { label: "Tidak Diketahui", emoji: "⚪" },
};

export const STATUS_CHOICES = Object.entries(STATUS).map(([value, s]) => ({
  name: s.label,
  value,
}));

export function escapeMd(text) {
  return String(text).replace(/([*_`~|>\\])/g, "\\$1");
}
