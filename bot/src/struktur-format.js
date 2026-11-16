import { STATUS } from "./format.js";

// Warna batang kiri embed: kertas & tinta, terbaca di tema gelap maupun terang.
export const COLORS = { header: 0xedeae3, section: 0xa8a29a };

export const STATUS_ORDER = ["AKTIF", "TIDAK_AKTIF", "DITURUNKAN", "TIDAK_DIKETAHUI"];

export const MAX_EMBED_DESC = 3800;

const pad = (text, width) => text + " ".repeat(Math.max(0, width - text.length));

/** "110000146b0a811" -> "steam:110000146b0a811" (awalan diseragamkan). */
const steamHex = (hex) => {
  if (!hex) return "";
  const value = String(hex).trim();
  return /^steam:/i.test(value) ? value : `steam:${value}`;
};

/**
 * Tabel monospace satu baris per anggota, kolom dipisah garis tegak:
 *   `⚫ ALFA ROMEO           | steam:11000015a41252d | 1324095888355754015`
 * Status ditandai emoji (bukan angka); arti tiap emoji ada di legenda header.
 * Nama di-pad supaya kolom hex & ID rata untuk semua baris.
 */
function buildTable(groups) {
  const all = groups.flatMap((g) => g.members);
  const width = {
    name: Math.max(0, ...all.map((m) => m.name.length)),
    hex: Math.max(0, ...all.map((m) => steamHex(m.hex).length)),
    id: Math.max(0, ...all.map((m) => (m.discordId ?? "").length)),
  };
  // emoji + spasi + nama + " | " + hex + " | " + id
  const lineWidth = 2 + width.name + 3 + width.hex + 3 + width.id;

  const row = (m) =>
    `${STATUS[m.status].emoji} ${pad(m.name, width.name)} | ${pad(steamHex(m.hex) || "—", width.hex)} | ${pad(m.discordId || "—", width.id)}`;

  return { row, lineWidth };
}

/** Bagi blok anggota per embed (satu anggota tidak pernah terbelah antar-embed). */
function chunkBlocks(blocks, max) {
  const chunks = [];
  let current = [];
  let size = 0;
  for (const block of blocks) {
    if (current.length && size + block.length + 1 > max) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(block);
    size += block.length + 1;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

function statusLine(groups) {
  const counts = new Map();
  for (const g of groups) for (const m of g.members) counts.set(m.status, (counts.get(m.status) ?? 0) + 1);
  return STATUS_ORDER.map((s) => `${STATUS[s].emoji} **${counts.get(s) ?? 0}** ${STATUS[s].label}`).join(" · ");
}

/** Ubah data grouped dari API menjadi daftar embed (header + satu kartu per jabatan). */
export function buildMessages(groups) {
  const total = groups.reduce((n, g) => n + g.members.length, 0);
  const { row, lineWidth } = buildTable(groups);
  const embeds = [
    {
      color: COLORS.header,
      title: "STRUKTUR CENTRAL-T",
      description: [
        `**${total} anggota** · ${groups.length} jabatan`,
        statusLine(groups),
      ].join("\n"),
    },
  ];

  for (const g of groups) {
    const blocks = g.members.length
      ? g.members.map((m) => row(m))
      : ["(belum ada anggota)".padEnd(lineWidth)];
    chunkBlocks(blocks, MAX_EMBED_DESC - 8).forEach((chunk, i) => {
      embeds.push({
        color: COLORS.section,
        title: `${g.name} — ${g.members.length} anggota${i > 0 ? " (lanjutan)" : ""}`,
        // Blok kode menjaga kolom tetap rata (font monospace).
        description: ["```", ...chunk, "```"].join("\n"),
      });
    });
  }
  return embeds;
}
