// Impor anggota dari Google Sheets (CSV) lewat API Central T.
// Simulasi : node scripts/import-sheet.mjs
// Tulis DB : node scripts/import-sheet.mjs --apply
const SHEET_ID = "129hfdDSgPnvrEAyN5hjny8pip_P3iDjMykSg2Vi7Bzs";
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`;
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const apply = process.argv.includes("--apply");

const POSITION_MAP = {
  "sesepuh/og": "OG",
  og: "OG",
  "under og": "UNDER OG",
  "big homies": "BIG HOMIES",
  homies: "HOMIES",
  "lil homies": "LIL HOMIES",
  tamu: "TAMU",
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

const res = await fetch(SHEET_URL);
if (!res.ok) throw new Error(`Gagal mengambil sheet: HTTP ${res.status}`);
const rows = parseCsv(await res.text());

// Dua blok kolom: [No, Nama, Jabatan, Steam hex, Status] mulai kolom 1 dan 7.
const entries = [];
const problems = [];
rows.forEach((r, i) => {
  for (const start of [1, 7]) {
    if (!/^\d+$/.test((r[start] ?? "").trim())) continue;
    const name = (r[start + 1] ?? "").trim().replace(/\s+/g, " ");
    if (!name) continue; // baris kosong di sheet
    const posRaw = (r[start + 2] ?? "").trim();
    const statusRaw = (r[start + 4] ?? "").trim();
    const position = POSITION_MAP[posRaw.toLowerCase()];
    const status = STATUS_MAP[statusRaw.toLowerCase()] ?? "TIDAK_DIKETAHUI";
    const hexRaw = (r[start + 3] ?? "").trim();
    if (!position) { problems.push(`Baris ${i + 1}: jabatan tidak dikenal "${posRaw}" (${name})`); continue; }
    if (statusRaw && !STATUS_MAP[statusRaw.toLowerCase()]) {
      problems.push(`Baris ${i + 1}: status "${statusRaw}" tidak dikenal -> TIDAK_DIKETAHUI (${name})`);
    }
    entries.push({ line: i + 1, name, position, status, hex: hexRaw || null });
  }
});

const positions = Object.fromEntries(
  (await (await fetch(`${BASE}/api/positions`)).json()).data.map((p) => [p.name, p.id]),
);
const grouped = (await (await fetch(`${BASE}/api/members/grouped`)).json()).data;
const existingNames = new Set(grouped.flatMap((g) => g.members.map((m) => m.name.toLowerCase())));
const seenHex = new Map(grouped.flatMap((g) => g.members.filter((m) => m.hex).map((m) => [m.hex, m.name])));

const summary = { dibuat: 0, dilewati: 0, hexDikosongkan: 0, gagal: 0 };
const notes = [];

for (const e of entries) {
  if (existingNames.has(e.name.toLowerCase())) {
    summary.dilewati++;
    notes.push(`SKIP    ${e.name} (sudah ada)`);
    continue;
  }
  let hex = e.hex ? e.hex.toLowerCase() : null;
  if (hex && !hex.startsWith("steam:")) hex = `steam:${hex}`;
  if (hex && seenHex.has(hex)) {
    notes.push(`HEX DOBEL  baris ${e.line}: ${e.name} memakai hex yang sama dengan ${seenHex.get(hex)} (${hex}) -> hex dikosongkan`);
    summary.hexDikosongkan++;
    hex = null;
  }
  if (!apply) {
    if (hex) seenHex.set(hex, e.name);
    summary.dibuat++;
    continue;
  }
  const r = await fetch(`${BASE}/api/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: e.name, positionId: positions[e.position], status: e.status, hex }),
  });
  const json = await r.json();
  if (r.ok) {
    summary.dibuat++;
    if (hex) seenHex.set(hex, e.name);
    existingNames.add(e.name.toLowerCase());
  } else {
    summary.gagal++;
    notes.push(`GAGAL   baris ${e.line} ${e.name}: ${JSON.stringify(json)}`);
  }
}

const byPos = {};
for (const e of entries) byPos[e.position] = (byPos[e.position] ?? 0) + 1;
console.log(apply ? "== IMPOR (ditulis ke database) ==" : "== SIMULASI (belum menulis apa pun) ==");
console.log("Terbaca dari sheet:", entries.length, byPos);
[...problems, ...notes].forEach((n) => console.log(n));
console.log(summary);
