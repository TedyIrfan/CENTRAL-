import { parseRegistrations } from "./src/tambah.js";

const cases = {
  "satu, rapi": "NAMA LENGKAP : Budi Santoso\nSTEAM HEX    : steam:110000112345678\nID DISCORD   : 123456789012345678",
  "satu, huruf kecil + mention": "nama lengkap: budi santoso\nsteam hex:110000112345678\nid discord:<@123456789012345678>",
  "satu, code block": "```\nNAMA LENGKAP : Budi Santoso\nSTEAM HEX    : steam:110000112345678\nID DISCORD   : 123456789012345678\n```",
  "hex & discord kosong": "NAMA LENGKAP : Budi\nSTEAM HEX    :\nID DISCORD   : -",
  "tanpa nama": "STEAM HEX : steam:110000112345678",
  "TIGA anggota, dipisah baris kosong":
    "NAMA LENGKAP : Andi\nSTEAM HEX : steam:11000012b53bf24\nID DISCORD : 111111111111111111\n\nNAMA LENGKAP : Beni\nSTEAM HEX : steam:1100001188d4f28\nID DISCORD : 222222222222222222\n\nNAMA LENGKAP : Cici\nSTEAM HEX : steam:110000132bce471\nID DISCORD : 333333333333333333",
  "tiga anggota, tanpa pemisah, tanpa discord":
    "NAMA LENGKAP : Andi\nSTEAM HEX : steam:11000012b53bf24\nNAMA LENGKAP : Beni\nSTEAM HEX : steam:1100001188d4f28\nNAMA LENGKAP : Cici\nSTEAM HEX : steam:110000132bce471",
  "dengan nomor & teks lain":
    "Daftar anggota baru ya:\n1.\nNama Lengkap: Andi\nSteam Hex: steam:11000012b53bf24\n2.\nNama Lengkap: Beni\nSteam Hex: steam:1100001188d4f28",
};

for (const [label, text] of Object.entries(cases)) {
  const r = parseRegistrations(text);
  console.log(`${label} -> ${r.length} blok`);
  r.forEach((b) => console.log("   ", JSON.stringify(b)));
}
