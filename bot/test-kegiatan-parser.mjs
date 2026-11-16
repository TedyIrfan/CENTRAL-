import assert from "node:assert/strict";
import { parseKegiatanText, parseDateIso } from "./src/kegiatan-format.js";

const screenshot = `NAMA ANGGOTA YANG IKUT KEGIATAN

TANGGAL KEGIATAN: 13/11/2026
KEGIATAN        : PENYANDRAAN JAPAPRIDE
NEGOSIASI       : MENANG 1JT UMER
NAMA ANGGOTA    :
 1. RENZO
 2. ROCKY
 3. SMITH
 4. NICO
 5. ZIXIE
 6. EL
 7. AKEW
 8. BIZAR
 9. JACK BRANDO
10. RUI
11. ZAKI
12. ASEP
13. IPAN`;

{
  const r = parseKegiatanText(screenshot);
  assert.equal(r.isAttempt, true);
  assert.equal(r.problems, undefined);
  assert.equal(r.data.title, "PENYANDRAAN JAPAPRIDE");
  assert.equal(r.data.negotiation, "MENANG 1JT UMER");
  assert.equal(r.data.activityDate, "2026-11-13");
  assert.deepEqual(r.data.participants, [
    "RENZO", "ROCKY", "SMITH", "NICO", "ZIXIE", "EL", "AKEW", "BIZAR",
    "JACK BRANDO", "RUI", "ZAKI", "ASEP", "IPAN",
  ]);
  console.log("OK  format persis screenshot (13 peserta)");
}

{
  const r = parseKegiatanText(
    "```\n**TANGGAL KEGIATAN** : 2026-11-14\n**KEGIATAN** :  PATROLI  MALAM\n**NEGOSIASI** : -\n**NAMA ANGGOTA** :\n1) RENZO\n2)  EL\n```",
  );
  assert.equal(r.isAttempt, true);
  assert.equal(r.problems, undefined);
  assert.equal(r.data.title, "PATROLI MALAM");
  assert.equal(r.data.negotiation, null);
  assert.equal(r.data.activityDate, "2026-11-14");
  assert.deepEqual(r.data.participants, ["RENZO", "EL"]);
  console.log("OK  blok kode, bold, titik dua renggang, negosiasi '-'");
}

{
  const r = parseKegiatanText("TANGGAL KEGIATAN: 32/11/2026\nKEGIATAN: TES\nNAMA ANGGOTA:\n1. A");
  assert.equal(r.isAttempt, true);
  assert.match(r.problems.join(" "), /TANGGAL KEGIATAN/);
  console.log("OK  tanggal tidak valid ditolak");
}

{
  const r = parseKegiatanText("NAMA ANGGOTA YANG IKUT KEGIATAN");
  assert.equal(r.isAttempt, true);
  assert.ok(r.problems.length > 0);
  console.log("OK  header saja dianggap percobaan tapi tidak valid");
}

{
  const r = parseKegiatanText("halo selamat pagi semua");
  assert.equal(r.isAttempt, false);
  console.log("OK  chat biasa diabaikan");
}

{
  const r = parseKegiatanText(
    "TANGGAL KEGIATAN: 13/11/2026\nKEGIATAN: TES\nNAMA ANGGOTA:\n1. RENZO\n2. renzo",
  );
  assert.match(r.problems.join(" "), /lebih dari sekali/);
  console.log("OK  peserta ganda ditolak");
}

{
  const r = parseKegiatanText("TANGGAL KEGIATAN: 13/11/2026\nKEGIATAN: TES\nNAMA ANGGOTA:\n1. RENZO");
  assert.equal(r.problems, undefined);
  assert.deepEqual(r.data.participants, ["RENZO"]);
  console.log("OK  peserta tanpa header tetap terbaca");
}

assert.equal(parseDateIso("13/11/2026"), "2026-11-13");
assert.equal(parseDateIso("2026-11-13"), "2026-11-13");
assert.equal(parseDateIso("31/02/2026"), null);
console.log("OK  parser tanggal");
