// Uji aturan akses edit di channel struktur. Jalankan: node bot/test-access.mjs
import { canEditStruktur } from "./src/access.js";

const BIG_HOMIES = "1541988598717354105";
const ROLE_LAIN = "999999999999999999";
const ALLOWED = [BIG_HOMIES];

const cases = [
  ["role BIG HOMIES", { roleIds: [BIG_HOMIES] }, true],
  ["role BIG HOMIES + role lain", { roleIds: [ROLE_LAIN, BIG_HOMIES] }, true],
  ["role lain saja", { roleIds: [ROLE_LAIN] }, false],
  ["tanpa role", { roleIds: [] }, false],
  ["tanpa role tapi Administrator", { roleIds: [], isAdmin: true }, true],
  ["tanpa role tapi Manage Server", { roleIds: [], isManageGuild: true }, true],
  ["member null", null, false],
];

let failed = 0;
for (const [label, member, expected] of cases) {
  const got = canEditStruktur(member, ALLOWED);
  const ok = got === expected;
  if (!ok) failed += 1;
  console.log(`${ok ? "OK  " : "GAGAL"}  ${label}: ${got} (harap ${expected})`);
}

console.log(failed === 0 ? "\nSemua kasus lolos." : `\n${failed} kasus gagal.`);
process.exitCode = failed === 0 ? 0 : 1;
