// Sinkronisasi anggota dari Google Sheets (CSV) ke database Central T lewat API web.
//
// Layout sheet (2 blok, kolomnya BEDA):
//   blok kiri  : 1 No | 2 Nama | 3 Jabatan | 4 Steam hex | 5 ID DISCORD | 6 Status
//   blok kanan : 8 No | 9 Nama | 10 Jabatan | 11 PJ (diabaikan) | 12 Status
//
// Pemakaian:
//   node scripts/import-sheet.mjs                    # simulasi (tidak menulis apa pun)
//   node scripts/import-sheet.mjs --apply            # buat baru + perbarui yang sudah ada
//   node scripts/import-sheet.mjs --apply --prune    # + hapus anggota yang tidak ada di sheet
//   ... --force                                      # tetap buat walau namanya mirip anggota lain
//
// Catatan: status & jabatan selalu dikirim bersamaan, jadi aturan otomatis
// "turun jabatan -> DITURUNKAN" di API tidak ikut jalan (status dari sheet yang menang).
const SHEET_ID = "129hfdDSgPnvrEAyN5hjny8pip_P3iDjMykSg2Vi7Bzs";
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`;
const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const apply = process.argv.includes("--apply");
const prune = process.argv.includes("--prune");
const force = process.argv.includes("--force");

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

// ---------- parser CSV ----------

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

// ---------- normalisasi ----------

const HEX_RE = /^steam:[0-9a-f]{8,17}$/;
const DISCORD_RE = /^\d{15,20}$/;

/** "steam: 1100..." / "1100..." / "STEAM:1100..." -> "steam:1100..." | null | "INVALID" */
function normHex(raw) {
  const v = (raw ?? "").trim().toLowerCase().replace(/\s+/g, "");
  if (!v) return null;
  const h = v.startsWith("steam:") ? v : `steam:${v}`;
  return HEX_RE.test(h) ? h : "INVALID";
}

/** Ambil 15-20 digit dari "<@123>", "123", "ID: 123" -> null | "INVALID" */
function normDiscord(raw) {
  const v = (raw ?? "").replace(/[^\d]/g, "");
  if (!v) return null;
  return DISCORD_RE.test(v) ? v : "INVALID";
}

/** "MEIO RAY (JONO)" -> "meio ray" untuk mencocokkan nama yang sudah ada. */
function baseName(name) {
  return name.toLowerCase().replace(/\s*\([^)]*\)\s*$/, "").trim();
}

/** Hanya huruf/angka, untuk membandingkan ejaan: "ANAXKYY" vs "ANAXKY (ZAKYY)" -> anaxkyy / anaxky. */
function squash(name) {
  return baseName(name).replace(/[^a-z0-9]/g, "");
}

function editDistance(a, b) {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

// ---------- baca sheet ----------

const res = await fetch(SHEET_URL);
if (!res.ok) throw new Error(`Gagal mengambil sheet: HTTP ${res.status}`);
const rows = parseCsv(await res.text());

const BLOCKS = [
  { start: 1, hasHex: true, hasDiscord: true },
  { start: 8, hasHex: false, hasDiscord: false },
];

const entries = [];
const problems = [];

rows.forEach((r, i) => {
  for (const b of BLOCKS) {
    const cell = (n) => (r[b.start + n] ?? "").trim();
    if (!/^\d+$/.test(cell(0))) continue;
    const name = cell(1).replace(/\s+/g, " ");
    if (!name) continue;

    const line = i + 1;
    const posRaw = cell(2);
    const position = POSITION_MAP[posRaw.toLowerCase()];
    if (!position) {
      problems.push(`baris ${line}: jabatan tidak dikenal "${posRaw}" (${name}) -> dilewati`);
      continue;
    }

    const statusRaw = cell(b.hasHex ? 5 : 4);
    const status = STATUS_MAP[statusRaw.toLowerCase()] ?? "TIDAK_DIKETAHUI";
    if (statusRaw && !STATUS_MAP[statusRaw.toLowerCase()]) {
      problems.push(`baris ${line}: status "${statusRaw}" tidak dikenal -> TIDAK_DIKETAHUI (${name})`);
    }

    const hex = b.hasHex ? normHex(cell(3)) : null;
    if (hex === "INVALID") {
      problems.push(`baris ${line}: hex tidak valid "${cell(3)}" -> dikosongkan (${name})`);
    }
    const discordId = b.hasDiscord ? normDiscord(cell(4)) : null;
    if (discordId === "INVALID") {
      problems.push(`baris ${line}: ID Discord tidak valid "${cell(4)}" -> dikosongkan (${name})`);
    }

    entries.push({
      line,
      name,
      position,
      status,
      hex: hex === "INVALID" ? null : hex,
      discordId: discordId === "INVALID" ? null : discordId,
    });
  }
});

// Nilai "ID DISCORD" yang sebenarnya SteamID64 dari hex orang yang sama (salah kolom).
// SteamID64 = nilai desimal dari hex tanpa awalan "steam:".
for (const e of entries) {
  if (!e.hex || !e.discordId) continue;
  try {
    const steamId64 = BigInt(`0x${e.hex.replace(/^steam:/i, "")}`).toString();
    if (e.discordId === steamId64) {
      problems.push(
        `baris ${e.line}: "ID DISCORD" ${e.discordId} = SteamID64 dari hex-nya, bukan ID Discord -> diabaikan (${e.name})`,
      );
      e.discordId = null;
    }
  } catch {
    // hex tidak bisa diparse: biarkan, sudah divalidasi di atas
  }
}

// Hex / ID Discord dobel di dalam sheet: yang pertama dipakai, sisanya dikosongkan.
const seenHex = new Map();
const seenDiscord = new Map();
for (const e of entries) {
  if (e.hex) {
    if (seenHex.has(e.hex)) {
      problems.push(`hex dobel ${e.hex}: "${e.name}" sama dengan "${seenHex.get(e.hex)}" -> hex dikosongkan`);
      e.hex = null;
    } else seenHex.set(e.hex, e.name);
  }
  if (e.discordId) {
    if (seenDiscord.has(e.discordId)) {
      problems.push(`ID Discord dobel ${e.discordId}: "${e.name}" sama dengan "${seenDiscord.get(e.discordId)}" -> dikosongkan`);
      e.discordId = null;
    } else seenDiscord.set(e.discordId, e.name);
  }
}

// ---------- baca database ----------

const posRes = await fetch(`${BASE}/api/positions`);
if (!posRes.ok) throw new Error(`API ${BASE} tidak bisa dibaca (HTTP ${posRes.status}). Web sudah jalan?`);
const positions = Object.fromEntries((await posRes.json()).data.map((p) => [p.name, p.id]));

const missingPositions = [...new Set(entries.map((e) => e.position))].filter((n) => !positions[n]);
if (missingPositions.length) {
  throw new Error(`Jabatan belum ada di database: ${missingPositions.join(", ")} — buat dulu di /positions`);
}

const grouped = (await (await fetch(`${BASE}/api/members/grouped`)).json()).data;
const existing = grouped.flatMap((g) =>
  g.members.map((m) => ({ ...m, positionName: g.name })),
);
const byName = new Map(existing.map((m) => [m.name.toLowerCase(), m]));
const byBase = new Map();
for (const m of existing) if (!byBase.has(baseName(m.name))) byBase.set(baseName(m.name), m);

// ---------- bandingkan ----------

const stats = { baru: 0, diperbarui: 0, tetap: 0, mirip: 0, gagal: 0 };
const changes = [];

// Anggota DB yang sudah "terwakili" oleh sebuah baris sheet (nama sama, beda ejaan,
// atau dibuat baru). Hanya yang TIDAK ada di sini yang boleh dihapus oleh --prune.
const matched = new Set();

for (const e of entries) {
  const exact = byName.get(e.name.toLowerCase());
  const near = exact ?? byBase.get(baseName(e.name));
  if (near) matched.add(near.id);
  if (!exact && near) {
    changes.push(`MIRIP   "${e.name}" dianggap sama dengan "${near.name}" (nama di DB dipertahankan)`);
  }

  if (!near) {
    // Beda ejaan (mis. "ANAXKYY" di sheet vs "ANAXKY (ZAKYY)" di DB) jangan sampai
    // membuat baris duplikat. Selisih <= 2 huruf dianggap orang yang sama.
    const squashed = squash(e.name);
    const fuzzy = existing.find((m) => {
      const s = squash(m.name);
      return s.length >= 4 && squashed.length >= 4 && editDistance(s, squashed) <= 2;
    });
    if (fuzzy && !force) {
      stats.mirip++;
      matched.add(fuzzy.id); // jangan dihapus oleh --prune: dia sudah terwakili baris ini
      changes.push(
        `MUNGKIN SAMA  "${e.name}" ~ "${fuzzy.name}" (ejaan beda -> tidak dibuat; pakai --force kalau memang orang lain)`,
      );
      continue;
    }
    stats.baru++;
    changes.push(`BARU    ${e.name} | ${e.position} | ${e.status} | ${e.hex ?? "-"} | ${e.discordId ?? "-"}`);
    if (apply) {
      const r = await fetch(`${BASE}/api/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: e.name,
          positionId: positions[e.position],
          status: e.status,
          hex: e.hex,
          discordId: e.discordId,
        }),
      });
      const json = await r.json().catch(() => null);
      const created = json?.data ?? null;
      if (!r.ok || !created) {
        stats.gagal++;
        changes.push(`GAGAL   ${e.name}: ${JSON.stringify(json)}`);
      } else {
        matched.add(created.id);
        byName.set(e.name.toLowerCase(), { ...created, positionName: e.position });
        byBase.set(baseName(e.name), { ...created, positionName: e.position });
      }
    }
    continue;
  }

  // Bandingkan field yang diatur sheet (nama & PJ tidak diubah).
  const wanted = { positionId: positions[e.position], status: e.status };
  const diff = [];
  if (near.positionName !== e.position) diff.push(`jabatan ${near.positionName} -> ${e.position}`);
  if (near.status !== e.status) diff.push(`status ${near.status} -> ${e.status}`);
  if (e.hex !== null && near.hex !== e.hex) diff.push(`hex ${near.hex ?? "-"} -> ${e.hex}`);
  if (e.discordId !== null && near.discordId !== e.discordId) {
    diff.push(`discord ${near.discordId ?? "-"} -> ${e.discordId}`);
  }
  if (e.hex === null && near.hex) diff.push("hex di sheet kosong (dibiarkan)");
  if (e.discordId === null && near.discordId) diff.push("discord di sheet kosong (dibiarkan)");

  const realDiff = diff.filter((d) => !d.includes("(dibiarkan)"));
  if (realDiff.length === 0) {
    stats.tetap++;
    continue;
  }
  stats.diperbarui++;
  changes.push(`UBAH    ${near.name}: ${realDiff.join("; ")}`);
  if (apply) {
    const body = { ...wanted };
    if (e.hex !== null) body.hex = e.hex;
    if (e.discordId !== null) body.discordId = e.discordId;
    const r = await fetch(`${BASE}/api/members/${near.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await r.json().catch(() => null);
    if (!r.ok) {
      stats.gagal++;
      changes.push(`GAGAL   ${near.name}: ${JSON.stringify(json)}`);
    }
  }
}

// Anggota di DB yang tidak terwakili satu baris sheet pun (hanya dilaporkan, kecuali --prune).
const onlyDb = existing.filter((m) => !matched.has(m.id));
if (onlyDb.length) {
  changes.push(`— ${onlyDb.length} anggota ada di DB tapi tidak di sheet:`);
  for (const m of onlyDb) {
    changes.push(`  ${prune ? "HAPUS " : "LEWAT "} ${m.name} (${m.positionName})`);
    if (prune && apply) {
      const r = await fetch(`${BASE}/api/members/${m.id}`, { method: "DELETE" });
      if (!r.ok) changes.push(`  GAGAL hapus ${m.name}: HTTP ${r.status}`);
    }
  }
}

// ---------- laporan ----------

const byPos = {};
for (const e of entries) byPos[e.position] = (byPos[e.position] ?? 0) + 1;

console.log(apply ? "== IMPOR (menulis ke database) ==" : "== SIMULASI (tidak menulis apa pun) ==");
console.log(`Sumber: sheet (${entries.length} baris terbaca) · DB sekarang: ${existing.length} anggota`);
console.log("Sebaran di sheet:", byPos);
console.log();
for (const c of problems) console.log(c);
for (const c of changes) console.log(c);
console.log();
console.log(
  `baru ${stats.baru} · diperbarui ${stats.diperbarui} · tetap ${stats.tetap} · mirip ${stats.mirip} · gagal ${stats.gagal}` +
    (onlyDb.length ? ` · hanya di DB ${onlyDb.length}${prune ? " (dihapus)" : " (dibiarkan)"}` : ""),
);
if (!apply) console.log("\nJalankan ulang dengan --apply untuk menulis ke database.");
