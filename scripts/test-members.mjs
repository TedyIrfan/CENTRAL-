// Uji end-to-end API anggota. Jalankan: node scripts/test-members.mjs [baseUrl]
const base = process.argv[2] ?? "http://localhost:3001";
let failed = 0;

async function call(method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

function check(label, cond, extra) {
  if (!cond) failed++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${cond ? "" : "  -> " + JSON.stringify(extra)}`);
}

const pos = Object.fromEntries(
  (await call("GET", "/api/positions")).json.data.map((p) => [p.name, p.id]),
);
const tag = Date.now().toString(16).padStart(15, "0").slice(-15);
const hex = `steam:${tag}`;
const created = [];

let r = await call("POST", "/api/members", {
  name: "  Budi   Test ",
  positionId: pos["HOMIES"],

  hex: tag.toUpperCase(), // tanpa prefix & huruf besar -> dinormalisasi
  status: "AKTIF",
});
check("create + normalisasi hex", r.status === 201 && r.json.data.hex === hex && r.json.data.name === "Budi Test", r);
const id = r.json.data?.id;
created.push(id);

r = await call("POST", "/api/members", { name: "Dobel", positionId: pos["OG"], hex });
check("hex duplikat -> 409", r.status === 409 && r.json.fields?.hex, r);

r = await call("POST", "/api/members", { name: "", hex: "xyz", status: "RANDOM" });
check("validasi: nama, jabatan, hex, status -> 422", r.status === 422 && ["name", "positionId", "hex", "status"].every((k) => r.json.fields?.[k]), r);

r = await call("POST", "/api/members", { name: "X", positionId: 999999 });
check("jabatan tidak ada -> 422", r.status === 422 && r.json.fields?.positionId, r);

r = await call("POST", "/api/members", { name: "Tanpa Hex", positionId: pos["OG"] });
check("create tanpa hex, status default", r.status === 201 && r.json.data.hex === null && r.json.data.status === "TIDAK_DIKETAHUI", r);
const id2 = r.json.data?.id;
created.push(id2);

r = await call("GET", `/api/members/${id}`);
check("get by id (ada jabatan)", r.status === 200 && r.json.data.position.name === "HOMIES", r);

r = await call("PATCH", `/api/members/${id}`, { name: "Budi Baru" });
check("update sebagian field", r.status === 200 && r.json.data.name === "Budi Baru" && r.json.data.position.name === "HOMIES", r);
check("respons tidak lagi punya field steam", !("steam" in r.json.data), r);

r = await call("PATCH", `/api/members/${id}`, {});
check("update kosong -> 400", r.status === 400, r);

r = await call("PATCH", `/api/members/${id}`, { hex: null });
check("hapus hex (null)", r.status === 200 && r.json.data.hex === null, r);
await call("PATCH", `/api/members/${id}`, { hex });

// --- ID Discord ---
const did = `9${tag.replace(/[a-f]/g, (c) => c.charCodeAt(0) % 10)}`.slice(0, 18).padEnd(18, "1");
r = await call("PATCH", `/api/members/${id}`, { discordId: `<@${did}>` });
check("discordId: mention dinormalisasi", r.status === 200 && r.json.data.discordId === did, r);

r = await call("PATCH", `/api/members/${id2}`, { discordId: did });
check("discordId duplikat -> 409", r.status === 409 && r.json.fields?.discordId, r);

r = await call("PATCH", `/api/members/${id2}`, { discordId: "abc" });
check("discordId tidak valid -> 422", r.status === 422 && r.json.fields?.discordId, r);

r = await call("GET", `/api/members?search=${did}`);
check("search discordId", r.json.data.some((m) => m.id === id), r);

// --- hierarki ---
r = await call("PATCH", `/api/members/${id}`, { status: "DITURUNKAN" });
check("status DITURUNKAN -> HOMIES turun ke LIL HOMIES", r.status === 200 && r.json.data.position.name === "LIL HOMIES" && r.json.data.status === "DITURUNKAN", r);

r = await call("PATCH", `/api/members/${id}`, { status: "DITURUNKAN", name: "Budi Test" });
check("status sama (sudah DITURUNKAN) tidak turun lagi", r.json.data.position.name === "LIL HOMIES", r);

r = await call("POST", `/api/members/${id}/promote`);
check("promote -> HOMIES, status DITURUNKAN jadi AKTIF", r.status === 200 && r.json.data.position.name === "HOMIES" && r.json.data.status === "AKTIF" && r.json.data.previousPosition === "LIL HOMIES", r);

r = await call("POST", `/api/members/${id}/demote`);
check("demote -> LIL HOMIES, status DITURUNKAN", r.status === 200 && r.json.data.position.name === "LIL HOMIES" && r.json.data.status === "DITURUNKAN", r);

r = await call("PATCH", `/api/members/${id2}`, { positionId: pos["OG"] });
r = await call("POST", `/api/members/${id2}/promote`);
check("promote dari OG -> 409 (tertinggi)", r.status === 409, r);

r = await call("POST", `/api/members/${id2}/demote`);
check("demote dari OG -> UNDER OG", r.status === 200 && r.json.data.position.name === "UNDER OG", r);

r = await call("PATCH", `/api/members/${id2}`, { positionId: pos["BIG HOMIES"], status: "DITURUNKAN" });
check("jabatan manual + DITURUNKAN -> pakai pilihan manual", r.json.data.position.name === "BIG HOMIES", r);

// --- list / filter / grouped ---
r = await call("GET", "/api/members?search=budi");
check("search nama", r.status === 200 && r.json.data.some((m) => m.id === id) && r.json.meta.total >= 1, r);

r = await call("GET", `/api/members?search=${tag.slice(2, 12)}`);
check("search hex", r.json.data.some((m) => m.id === id), r);

r = await call("GET", `/api/members?positionId=${pos["LIL HOMIES"]}&status=DITURUNKAN`);
check("filter jabatan + status", r.json.data.some((m) => m.id === id) && r.json.data.every((m) => m.position.name === "LIL HOMIES"), r);

r = await call("GET", "/api/members?pageSize=1&page=1");
check("pagination", r.json.data.length <= 1 && r.json.meta.pageSize === 1, r);

r = await call("GET", "/api/members?status=NGAWUR&page=0");
check("query tidak valid -> 422", r.status === 422, r);

r = await call("GET", "/api/members/grouped");
const names = r.json.data?.map((g) => g.name);
check("grouped urut hierarki", JSON.stringify(names.slice(0, 5)) === JSON.stringify(["OG", "UNDER OG", "BIG HOMIES", "HOMIES", "LIL HOMIES"]), names);
check("grouped memuat anggota di jabatannya", r.json.data.find((g) => g.name === "LIL HOMIES").members.some((m) => m.id === id), r);

// --- jabatan dipakai tidak bisa dihapus ---
r = await call("DELETE", `/api/positions/${pos["LIL HOMIES"]}`);
check("hapus jabatan yang dipakai -> 409", r.status === 409, r);

// --- hapus ---
for (const mid of created) {
  r = await call("DELETE", `/api/members/${mid}`);
  check(`delete anggota ${mid}`, r.status === 200, r);
}
r = await call("GET", `/api/members/${id}`);
check("setelah delete -> 404", r.status === 404, r);

console.log(failed ? `\n${failed} gagal` : "\nSemua lolos");
process.exit(failed ? 1 : 0);
