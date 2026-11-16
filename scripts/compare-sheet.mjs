// Bandingkan isi Google Sheet dengan database, field demi field.
//
//   node scripts/compare-sheet.mjs
//
// Keluar dengan kode 1 kalau ada selisih (enak dipakai di CI / cek cepat).
// Aturan pencocokan sama dengan scripts/import-sheet.mjs: nama persis, lalu nama tanpa
// keterangan dalam kurung ("MEIO RAY (JONO)" ~ "MEIO RAY").
const SHEET_ID = "129hfdDSgPnvrEAyN5hjny8pip_P3iDjMykSg2Vi7Bzs";
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`;
const BASE = process.env.BASE_URL ?? "http://localhost:3001";

const POSITION_MAP = {
  "sepuh/og": "OG",
  "sesepuh/og": "OG",
  og: "OG",
  "under og": "UNDER OG",
  "big homies": "BIG HOMIES",
  homies: "HOMIES",
  "lil homies": "LIL HOMIES",
};
const STATUS_MAP = {
  aktif: "AKTIF",
  tidak: "TIDAK_AKTIF",
  "tidak aktif": "TIDAK_AKTIF",
  turunin: "DITURUNKAN",
  diturunkan: "DITURUNKAN",
  "gak diketahui": "TIDAK_DIKETAHUI",
  "tidak diketahui": "TIDAK_DIKETAHUI",
};

function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const normHex = (v) => {
  const s = (v ?? "").trim().toLowerCase().replace(/\s+/g, "");
  if (!s) return null;
  return s.startsWith("steam:") ? s : `steam:${s}`;
};
const normDiscord = (v) => (v ?? "").replace(/[^\d]/g, "") || null;
const baseName = (n) => n.toLowerCase().replace(/\s*\([^)]*\)\s*$/, "").trim();
const cleanName = (v) => (v ?? "").replace(/\s+/g, " ").trim();

const rows = parseCsv(await (await fetch(SHEET_URL)).text());
const sheet = [];
rows.forEach((r, i) => {
  // blok kiri: No|Nama|Jabatan|Hex|ID DISCORD|Status — blok kanan: No|Nama|Jabatan|PJ|Status
  for (const b of [{ start: 1, hasHex: true, hasDiscord: true }, { start: 8, hasHex: false, hasDiscord: false }]) {
    const cell = (n) => (r[b.start + n] ?? "").trim();
    if (!/^\d+$/.test(cell(0)) || !cleanName(cell(1))) continue;
    sheet.push({
      line: i + 1,
      name: cleanName(cell(1)),
      position: POSITION_MAP[cell(2).toLowerCase()] ?? `?${cell(2)}`,
      status: STATUS_MAP[cell(b.hasHex ? 5 : 4).toLowerCase()] ?? "TIDAK_DIKETAHUI",
      hex: b.hasHex ? normHex(cell(3)) : null,
      discordId: b.hasDiscord ? normDiscord(cell(4)) : null,
    });
  }
});

const groups = (await (await fetch(`${BASE}/api/members/grouped`)).json()).data;
const db = groups.flatMap((g) =>
  g.members.map((m) => ({ name: m.name, position: g.name, status: m.status, hex: m.hex, discordId: m.discordId })),
);

const byName = new Map(db.map((m) => [m.name.toLowerCase(), m]));
const byBase = new Map();
for (const m of db) if (!byBase.has(baseName(m.name))) byBase.set(baseName(m.name), m);

const diffs = [];
const used = new Set();
const onlySheet = [];
for (const s of sheet) {
  const d = byName.get(s.name.toLowerCase()) ?? byBase.get(baseName(s.name));
  if (!d) { onlySheet.push(s); continue; }
  used.add(d.name);
  const fields = [];
  if (d.name.toLowerCase() !== s.name.toLowerCase()) fields.push(`nama: sheet "${s.name}" vs db "${d.name}"`);
  if (d.position !== s.position) fields.push(`jabatan: sheet "${s.position}" vs db "${d.position}"`);
  if (d.status !== s.status) fields.push(`status: sheet "${s.status}" vs db "${d.status}"`);
  if (s.hex !== null && d.hex !== s.hex) fields.push(`hex: sheet "${s.hex}" vs db "${d.hex ?? "(kosong)"}"`);
  if (s.discordId !== null && d.discordId !== s.discordId) {
    fields.push(`discord: sheet "${s.discordId}" vs db "${d.discordId ?? "(kosong)"}"`);
  }
  if (fields.length) diffs.push({ line: s.line, name: s.name, fields });
}
const onlyDb = db.filter((m) => !used.has(m.name));

console.log(`sheet: ${sheet.length} baris · database: ${db.length} anggota · cocok: ${sheet.length - diffs.length - onlySheet.length}`);
for (const d of diffs) {
  console.log(`\n[sheet baris ${d.line}] ${d.name}`);
  for (const f of d.fields) console.log(`    ${f}`);
}
if (onlySheet.length) {
  console.log(`\nHANYA DI SHEET (${onlySheet.length}):`);
  for (const s of onlySheet) console.log(`  baris ${s.line} ${s.name}`);
}
if (onlyDb.length) {
  console.log(`\nHANYA DI DATABASE (${onlyDb.length}):`);
  for (const m of onlyDb) console.log(`  ${m.name} (${m.position})`);
}
if (!diffs.length && !onlySheet.length && !onlyDb.length) {
  console.log("\nSEMUA DATA SAMA");
} else {
  process.exitCode = 1;
}
