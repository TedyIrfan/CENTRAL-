import { api, ApiError } from "./api.js";
import { escapeMd } from "./format.js";
import { WD_TEMPLATE, parseWdText } from "./wd-format.js";
import { wdChannelId } from "./wd.js";

const NOTICE_TTL_MS = 25_000;

function normalizeName(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function describe(err) {
  if (err instanceof ApiError) {
    const detail = err.fields ? Object.values(err.fields).join("; ") : "";
    return detail ? `${err.message}: ${detail}` : err.message;
  }
  return err?.message ?? String(err);
}

class UserError extends Error {}

async function notice(message, content) {
  const sent = await message
    .reply({ content: content.slice(0, 1950), allowedMentions: { repliedUser: false } })
    .catch(() => null);
  if (sent) setTimeout(() => sent.delete().catch(() => {}), NOTICE_TTL_MS);
}

async function fail(message, reason) {
  await message.react("⚠️").catch(() => {});
  await notice(
    message,
    [`⚠️ ${reason}`, "", "Format yang benar:", "```", WD_TEMPLATE, "```"].join("\n"),
  );
}

/** Cocokkan NAMA di format (tanpa "CT - ") ke anggota yang terdaftar. */
async function resolveMember(name) {
  const { data } = await api(`/api/members?search=${encodeURIComponent(name)}&pageSize=25`);
  const wanted = normalizeName(name);
  const exact = data.filter((m) => normalizeName(m.name) === wanted);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) {
    throw new UserError(`Nama "${name}" cocok dengan ${exact.length} anggota — tulis nama yang lebih lengkap.`);
  }

  // Format manual sering memakai nama pendek ("CT - IPAN") padahal database
  // menyimpan nama lengkap ("IPAN NAS").
  const prefix = data.filter((m) => normalizeName(m.name).startsWith(`${wanted} `));
  if (prefix.length === 1) return prefix[0];
  if (prefix.length > 1) {
    throw new UserError(
      `Nama "${name}" cocok dengan ${prefix.length} anggota (${prefix.map((m) => m.name).join(", ")}) — tulis nama lengkap.`,
    );
  }

  throw new UserError(`Anggota "${name}" tidak ditemukan di data anggota.`);
}

/** Cari transaksi DIPINJAM yang cocok dengan format pengembalian. */
async function findOpenRecord(data) {
  const query = data.serialNumber || data.itemName;
  const { data: rows } = await api(
    `/api/wd?status=DIPINJAM&search=${encodeURIComponent(query)}&pageSize=50`,
  );
  const hits = rows.filter((r) => {
    if (data.serialNumber) {
      return normalizeName(r.serialNumber ?? "") === normalizeName(data.serialNumber);
    }
    return (
      normalizeName(r.borrowerName) === normalizeName(`CT - ${data.memberName}`) &&
      normalizeName(r.itemName) === normalizeName(data.itemName)
    );
  });
  if (hits.length === 1) return hits[0];
  if (hits.length > 1) {
    throw new UserError(
      `Ada ${hits.length} transaksi yang cocok (${hits.map((r) => r.code).join(", ")}) — sertakan SN agar jelas.`,
    );
  }
  throw new UserError(
    "Tidak ada transaksi yang masih dipinjam dengan data itu. Kalau barangnya belum pernah dicatat, catat pengambilannya dulu.",
  );
}

let queue = Promise.resolve();

/** Pintu masuk auto-catat WD dari chat; diproses berurutan agar kode WD tidak bentrok. */
export function handleWdMessage(message, deps = {}) {
  const run = queue.then(() => processMessage(message, deps));
  queue = run.catch(() => {});
  return run;
}

async function processMessage(message, deps) {
  if (!message?.guild || message.author?.bot) return;
  if (!wdChannelId() || message.channelId !== wdChannelId()) return;

  const parsed = parseWdText(message.content);
  if (!parsed.isAttempt) return;

  // Sudah pernah dicatat (ditandai ✅ oleh bot) — jangan dobel saat pesan diedit.
  if (message.reactions?.cache?.get("✅")?.me) return;

  const member = await message.guild.members.fetch(message.author.id).catch(() => null);
  if (deps.isAllowedMember && !deps.isAllowedMember(member)) {
    await message.react("⛔").catch(() => {});
    return;
  }

  if (parsed.problems?.length) {
    await fail(message, parsed.problems.join("\n• "));
    return;
  }

  try {
    if (parsed.data.type === "ambil") {
      const row = await resolveMember(parsed.data.memberName);
      const { data } = await api("/api/wd", {
        method: "POST",
        body: {
          memberId: row.id,
          itemName: parsed.data.itemName,
          isWeapon: parsed.data.isWeapon,
          serialNumber: parsed.data.serialNumber,
          durabilityStart: parsed.data.durabilityStart,
          qty: parsed.data.qty,
          takenAt: parsed.data.takenAt,
          purpose: parsed.data.purpose,
        },
      });
      console.log(`[wd] ${data.code} dicatat dari chat oleh ${message.author.username}`);
      await message.react("✅").catch(() => {});
      await notice(
        message,
        `✅ **${data.code}** tercatat — ${escapeMd(data.borrowerName)} · ${escapeMd(data.itemName)}` +
          (data.serialNumber ? ` (SN \`${escapeMd(data.serialNumber)}\`)` : "") +
          `.\nKembalikan lewat \`/wd kembali kode:${data.code}\` atau halaman web WD.`,
      );
      deps.onChanged?.();
      return;
    }

    const record = await findOpenRecord(parsed.data);
    const { data } = await api(`/api/wd/${record.id}/return`, {
      method: "POST",
      body: {
        returnedAt: parsed.data.returnedAt,
        durabilityReturn: parsed.data.durabilityReturn,
      },
    });
    console.log(`[wd] ${data.code} dikembalikan dari chat oleh ${message.author.username}`);
    await message.react("✅").catch(() => {});
    await notice(
      message,
      `✅ **${data.code}** dikembalikan — ${escapeMd(data.borrowerName)} · ${escapeMd(data.itemName)}` +
        (data.durabilityReturn !== null ? ` · durab ${data.durabilityReturn}%` : "") +
        ".",
    );
    deps.onChanged?.();
  } catch (err) {
    console.error(`[wd] gagal memproses pesan ${message.id}:`, describe(err));
    await fail(message, describe(err));
  }
}
