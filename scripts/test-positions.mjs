// Uji end-to-end API jabatan. Jalankan: node scripts/test-positions.mjs [baseUrl]
const base = process.argv[2] ?? "http://localhost:3000";
let failed = 0;

async function call(method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

function check(label, cond, extra) {
  if (!cond) failed++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${cond ? "" : "  -> " + JSON.stringify(extra)}`);
}

const tag = `Test-${Date.now()}`;
let r = await call("POST", "/api/positions", { name: `  ${tag}   Satu ` });
check("create (trim + spasi ganda)", r.status === 201 && r.json.data.name === `${tag} Satu`, r);
const id = r.json.data?.id;

const before = await call("GET", "/api/positions");
const maxOrder = Math.max(...before.json.data.map((p) => p.sortOrder));
check("jabatan baru ditaruh paling bawah", r.json.data.sortOrder === maxOrder, { maxOrder, r });

r = await call("POST", "/api/positions", { name: `${tag.toUpperCase()} SATU` });
check("duplikat beda huruf -> 409", r.status === 409 && r.json.fields?.name, r);

r = await call("POST", "/api/positions", { name: "   " });
check("nama kosong -> 422", r.status === 422, r);

r = await call("POST", "/api/positions", { name: "x".repeat(101) });
check("nama >100 -> 422", r.status === 422, r);

r = await call("POST", "/api/positions", "bukan json");
check("body bukan JSON -> 400", r.status === 400, r);

r = await call("GET", "/api/positions");
check("list memuat data", r.status === 200 && r.json.data.some((p) => p.id === id), r);

r = await call("PATCH", `/api/positions/${id}`, { name: `${tag} Dua` });
check("update", r.status === 200 && r.json.data.name === `${tag} Dua`, r);

r = await call("PATCH", `/api/positions/${id}`, { name: `${tag} Dua` });
check("update nama sendiri tidak dianggap duplikat", r.status === 200, r);

r = await call("PATCH", "/api/positions/999999", { name: "Apa saja" });
check("update id tak ada -> 404", r.status === 404, r);

r = await call("GET", "/api/positions/abc");
check("id tidak valid -> 400", r.status === 400, r);

r = await call("GET", `/api/positions/${id}`);
check("get by id + memberCount", r.status === 200 && r.json.data.memberCount === 0, r);

r = await call("DELETE", `/api/positions/${id}`);
check("delete", r.status === 200 && r.json.data.id === id, r);

r = await call("DELETE", `/api/positions/${id}`);
check("delete ulang -> 404", r.status === 404, r);

console.log(failed ? `\n${failed} gagal` : "\nSemua lolos");
process.exit(failed ? 1 : 0);
