import { escapeMd } from "./format.js";
import { api, ApiError, UserError } from "./api.js";
import { buildDeleteConfirm } from "./hapus.js";
import { buildItem, parseRegistrations } from "./tambah.js";

const MAX_ENTRIES = 25;
const NOTICE_TTL_MS = 25_000;
const ACTIONS = ["TAMBAH", "UBAH", "NAIK", "TURUN", "HAPUS"];
const STATUSES = ["AKTIF", "TIDAK_AKTIF", "DITURUNKAN", "TIDAK_DIKETAHUI"];

const TEMPLATE = [
  "AKSI         : TAMBAH | UBAH | NAIK | TURUN | HAPUS   (opsional, default TAMBAH)",
  "NAMA LENGKAP :",
  "STEAM HEX    :",
  "ID DISCORD   :",
  "JABATAN      :",
];

async function notice(message, content) {
  const sent = await message
    .reply({ content, allowedMentions: { repliedUser: false } })
    .catch(() => null);
  if (sent) setTimeout(() => sent.delete().catch(() => {}), NOTICE_TTL_MS);
}

function describe(err) {
  if (err instanceof ApiError) {
    const detail = err.fields ? Object.values(err.fields).join("; ") : "";
    return detail ? `${err.message}: ${detail}` : err.message;
  }
  return err?.message ?? String(err);
}

function detectAction(text) {
  // Sama seperti parser: buang backtick/penanda markdown, supaya format di dalam
  // blok kode (```...```) tetap terbaca.
  const clean = text.replace(/[`*~|]/g, "");
  const m = /^\s*AKSI\s*[:=]\s*(.*?)\s*$/im.exec(clean);
  return m ? m[1].toUpperCase() : null;
}

function normalizeHex(raw) {
  if (raw === "" || raw === "-") return null;
  let h = String(raw).trim().toLowerCase();
  if (/^[0-9a-f]{8,17}$/.test(h)) h = `steam:${h}`;
  if (!/^steam:[0-9a-f]{8,17}$/.test(h)) throw new UserError(`Steam Hex "${raw}" tidak valid`);
  return h;
}

function normalizeDiscord(raw) {
  if (raw === "" || raw === "-") return null;
  const id = String(raw).trim().replace(/^<@!?(\d+)>$/, "$1");
  if (!/^\d{15,20}$/.test(id)) throw new UserError(`ID Discord "${raw}" tidak valid`);
  return id;
}

/** Cari anggota: utamakan nama persis, kalau tidak ada pakai satu-satunya hasil pencarian. */
async function findMember(name) {
  const q = name.trim();
  const { data } = await api(`/api/members?search=${encodeURIComponent(q)}&pageSize=25`);
  const lower = q.toLowerCase();

  const exact = data.filter((m) => m.name.toLowerCase() === lower);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) {
    throw new UserError(`Ada ${exact.length} anggota bernama "${q}". Tulis nama yang lebih khusus.`);
  }
  if (data.length === 1) return data[0];
  if (data.length === 0) throw new UserError(`Anggota "${q}" tidak ditemukan.`);
  throw new UserError(`Ada ${data.length} anggota yang cocok dengan "${q}". Tulis nama lebih lengkap.`);
}

// ---------- TAMBAH ----------

async function handleTambah(blocks, message, deps) {
  if (blocks.length > MAX_ENTRIES) {
    await notice(message, `Terlalu banyak (${blocks.length}). Maksimal ${MAX_ENTRIES} anggota per pesan.`);
    return false;
  }

  const { data: positions } = await api("/api/positions");
  const positionByName = new Map(positions.map((p) => [p.name.toLowerCase(), p]));
  const grouped = (await api("/api/members/grouped")).data;
  const existing = new Set(grouped.flatMap((g) => g.members.map((m) => m.name.toLowerCase())));

  const added = [];
  const failed = [];

  for (const [i, block] of blocks.entries()) {
    // Format wajib: keempat baris harus ada, walau nilainya boleh "-".
    const missing = [];
    if (block.name === null) missing.push("NAMA LENGKAP");
    if (block.hex === null) missing.push("STEAM HEX");
    if (block.discord === null) missing.push("ID DISCORD");
    if (block.position === null) missing.push("JABATAN");
    if (missing.length) {
      failed.push(`Blok ${i + 1}: baris ${missing.join(", ")} tidak ada`);
      continue;
    }

    // single: false -> ID Discord tidak diambil dari akun pengirim, harus dari format.
    const item = buildItem(block, i, { author: message.author, single: false });
    if (item.error) {
      failed.push(item.error);
      continue;
    }

    const key = item.name.toLowerCase();
    if (existing.has(key)) {
      failed.push(`${escapeMd(item.name)}: sudah ada di database`);
      continue;
    }
    if (block.hex && !item.hex) {
      failed.push(`${escapeMd(item.name)}: Steam Hex "${escapeMd(block.hex)}" tidak valid`);
      continue;
    }
    if (block.discord && !item.discordId) {
      failed.push(`${escapeMd(item.name)}: ID Discord "${escapeMd(block.discord)}" tidak valid`);
      continue;
    }

    const position = item.position ? positionByName.get(item.position.toLowerCase()) : null;
    if (!position) {
      failed.push(
        item.position
          ? `${escapeMd(item.name)}: JABATAN "${escapeMd(item.position)}" tidak dikenali`
          : `${escapeMd(item.name)}: JABATAN belum diisi`,
      );
      continue;
    }

    try {
      const { data } = await api("/api/members", {
        method: "POST",
        body: {
          name: item.name,
          positionId: position.id,
          status: "AKTIF",
          ...(item.hex ? { hex: item.hex } : {}),
          ...(item.discordId ? { discordId: item.discordId } : {}),
        },
      });
      added.push(data);
      existing.add(key);
    } catch (err) {
      failed.push(`${escapeMd(item.name)}: ${describe(err)}`);
    }
  }

  if (added.length) {
    deps.refreshStruktur();
    console.log(
      `[daftar] TAMBAH ${added.length} anggota oleh ${message.author.username}: ` +
        added.map((m) => m.name).join(", "),
    );
  }

  if (failed.length) {
    const lines = [
      added.length
        ? `✅ Masuk: ${added.map((m) => `**${escapeMd(m.name)}** (${m.position.name})`).join(", ")}`
        : null,
      "⚠️ Dilewati:",
      ...failed.map((f) => `• ${f}`),
      "",
      "Format:",
      "```",
      ...TEMPLATE,
      "```",
    ].filter((l) => l !== null);
    await notice(message, lines.join("\n").slice(0, 1900));
  }

  return failed.length === 0;
}

// ---------- UBAH ----------

async function handleUbah(block, message, deps) {
  const member = await findMember(block.name);
  const body = {};

  if (block.nameBaru !== null) {
    if (!block.nameBaru.trim()) throw new UserError("NAMA BARU kosong.");
    body.name = block.nameBaru.trim();
  }
  if (block.hex !== null) body.hex = normalizeHex(block.hex);
  if (block.discord !== null) body.discordId = normalizeDiscord(block.discord);
  if (block.status !== null) {
    const s = block.status.trim().toUpperCase();
    if (!STATUSES.includes(s)) {
      throw new UserError(`Status "${block.status}" tidak valid. Pilihan: ${STATUSES.join(", ")}.`);
    }
    body.status = s;
  }
  if (block.position !== null) {
    const { data: positions } = await api("/api/positions");
    const p = positions.find((x) => x.name.toLowerCase() === block.position.trim().toLowerCase());
    if (!p) throw new UserError(`Jabatan "${block.position}" tidak dikenali.`);
    body.positionId = p.id;
  }

  if (Object.keys(body).length === 0) {
    throw new UserError(
      "Tidak ada yang diubah. Isi minimal satu: NAMA BARU, JABATAN, STEAM HEX, ID DISCORD, atau STATUS.",
    );
  }

  const { data } = await api(`/api/members/${member.id}`, { method: "PATCH", body });
  deps.refreshStruktur();
  console.log(`[daftar] UBAH ${data.name} oleh ${message.author.username}`);
}

// ---------- NAIK / TURUN ----------

async function handleNaikTurun(action, block, message, deps) {
  const member = await findMember(block.name);

  // Dengan JABATAN: pindah langsung ke jabatan itu (boleh lompat beberapa tingkat).
  // Tanpa JABATAN: geser satu tingkat seperti sebelumnya.
  if (block.position !== null) {
    const { data: positions } = await api("/api/positions");
    const current = positions.find((p) => p.id === member.position.id);
    const target = positions.find((p) => p.name.toLowerCase() === block.position.trim().toLowerCase());

    if (!target) throw new UserError(`Jabatan "${block.position}" tidak dikenali.`);
    if (!current) throw new UserError("Jabatan anggota saat ini tidak ada di daftar jabatan.");
    if (target.id === current.id) throw new UserError(`"${member.name}" sudah di jabatan ${current.name}.`);

    if (action === "NAIK" && target.sortOrder > current.sortOrder) {
      throw new UserError(
        `${target.name} lebih rendah dari ${current.name}. Untuk turun jabatan pakai AKSI : TURUN.`,
      );
    }
    if (action === "TURUN" && target.sortOrder < current.sortOrder) {
      throw new UserError(
        `${target.name} lebih tinggi dari ${current.name}. Untuk naik jabatan pakai AKSI : NAIK.`,
      );
    }

    const { data } = await api(`/api/members/${member.id}`, {
      method: "PATCH",
      body: { positionId: target.id },
    });
    deps.refreshStruktur();
    console.log(
      `[daftar] ${action} ${data.name}: ${current.name} -> ${data.position.name} oleh ${message.author.username}`,
    );
    return;
  }

  const { data } = await api(`/api/members/${member.id}/${action === "NAIK" ? "promote" : "demote"}`, {
    method: "POST",
  });
  deps.refreshStruktur();
  console.log(
    `[daftar] ${action} ${data.name}: ${data.previousPosition} -> ${data.position.name} oleh ${message.author.username}`,
  );
}

// ---------- HAPUS ----------

async function handleHapus(block, message) {
  const member = await findMember(block.name);
  const { data } = await api(`/api/members/${member.id}`);
  const payload = buildDeleteConfirm({ id: message.id, user: message.author }, data);
  await message.reply({ ...payload, allowedMentions: { repliedUser: false } });
}

// ---------- pintu masuk ----------

/**
 * Pesan di channel pendaftaran. Baris AKSI menentukan aksi (default TAMBAH):
 *   TAMBAH -> NAMA LENGKAP / STEAM HEX / ID DISCORD / JABATAN (wajib 4 baris)
 *   UBAH   -> NAMA LENGKAP + minimal satu field yang diganti
 *   NAIK   -> NAMA LENGKAP
 *   TURUN  -> NAMA LENGKAP
 *   HAPUS  -> NAMA LENGKAP (selalu minta konfirmasi tombol)
 */
export async function handleRegistrationMessage(message, deps) {
  if (message.author.bot || !message.guild) return;

  const text = message.content ?? "";
  if (!text.trim()) return;

  const action = detectAction(text);
  const blocks = parseRegistrations(text);
  const withName = blocks.filter((b) => b.name);

  // Bukan format apa pun: diamkan saja.
  if (!action && withName.length === 0) return;

  const member = await message.guild.members.fetch(message.author.id).catch(() => null);
  if (!deps.isAllowedMember(member)) {
    await message.react("⛔").catch(() => {});
    return;
  }

  const act = action ?? "TAMBAH";
  if (!ACTIONS.includes(act)) {
    await notice(message, `⚠️ AKSI "${action}" tidak dikenal. Pilihan: ${ACTIONS.join(", ")}.`);
    await message.react("⚠️").catch(() => {});
    return;
  }

  if (act === "TAMBAH") {
    const ok = await handleTambah(blocks, message, deps);
    await message.react(ok ? "✅" : "⚠️").catch(() => {});
    return;
  }

  // Aksi selain TAMBAH: satu anggota per pesan.
  if (withName.length === 0) {
    await notice(message, `⚠️ NAMA LENGKAP wajib diisi untuk aksi ${act}.`);
    await message.react("⚠️").catch(() => {});
    return;
  }
  if (withName.length > 1) {
    await notice(message, `⚠️ Aksi ${act} hanya untuk satu anggota per pesan.`);
    await message.react("⚠️").catch(() => {});
    return;
  }

  const block = withName[0];

  try {
    if (act === "HAPUS") {
      await handleHapus(block, message);
      return; // konfirmasi tombol jadi balasannya
    }
    if (act === "UBAH") await handleUbah(block, message, deps);
    else await handleNaikTurun(act, block, message, deps);
    await message.react("✅").catch(() => {});
  } catch (err) {
    console.error(`[daftar] ${act} gagal untuk "${block.name}":`, describe(err));
    await message.react("⚠️").catch(() => {});
    await notice(message, `⚠️ ${describe(err)}`);
  }
}
