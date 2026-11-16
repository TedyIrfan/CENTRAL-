import { EmbedBuilder } from "discord.js";
import { api, ApiError } from "./api.js";
import { escapeMd } from "./format.js";
import { KEGIATAN_TEMPLATE, fmtDate, parseKegiatanText } from "./kegiatan-format.js";

const NOTICE_TTL_MS = 25_000;
const WIB = "Asia/Jakarta";

export function kegiatanChannelId() {
  return process.env.KEGIATAN_CHANNEL_ID || null;
}

function normalizeName(name) {
  return String(name).trim().toLowerCase().replace(/\s+/g, " ");
}

function describe(err) {
  if (err instanceof ApiError) {
    const detail = err.fields ? Object.values(err.fields).join("; ") : "";
    return detail ? `${err.message}: ${detail}` : err.message;
  }
  return err?.message ?? String(err);
}

async function findByMessage(messageId) {
  const { data } = await api(
    `/api/activities?discordMessageId=${encodeURIComponent(messageId)}&pageSize=1`,
  );
  return data[0] ?? null;
}

/**
 * Cocokkan nama peserta ke anggota yang terdaftar (persis, case-insensitive).
 * Nama yang tidak ketemu tetap disimpan sebagai peserta manual — sama seperti web.
 */
async function resolveParticipants(names) {
  const { data: groups } = await api("/api/members/grouped");
  const byName = new Map();
  for (const group of groups) {
    for (const member of group.members ?? []) {
      const key = normalizeName(member.name);
      const list = byName.get(key) ?? [];
      list.push(member);
      byName.set(key, list);
    }
  }

  const notes = [];
  const participants = names.map((name) => {
    const hits = byName.get(normalizeName(name)) ?? [];
    if (hits.length === 1) return { memberId: hits[0].id, name: hits[0].name };
    if (hits.length > 1) {
      notes.push(`"${name}" cocok dengan ${hits.length} anggota — disimpan sebagai nama manual`);
    } else {
      notes.push(`"${name}" tidak ada di database anggota — disimpan sebagai nama manual`);
    }
    return { memberId: null, name };
  });
  return { participants, notes };
}

// ---------- handler pesan ----------

async function notice(message, content) {
  const sent = await message
    .reply({ content: content.slice(0, 1950), allowedMentions: { repliedUser: false } })
    .catch(() => null);
  if (sent) setTimeout(() => sent.delete().catch(() => {}), NOTICE_TTL_MS);
}

async function fail(message, reason) {
  await message.react("⚠️").catch(() => {});
  const content = [`⚠️ ${reason}`, "", "Format yang benar:", "```", KEGIATAN_TEMPLATE, "```"].join("\n");
  await notice(message, content);
}

/**
 * Pintu masuk auto-catat: pesan format baku di channel kegiatan.
 * Pesan baru -> POST; pesan yang diedit -> PATCH baris yang sama (tidak dobel).
 * Diproses berurutan supaya dua pesan yang masuk bersamaan tidak berebut kode KGT.
 */
let queue = Promise.resolve();

export function handleKegiatanMessage(message, deps) {
  const run = queue.then(() => processMessage(message, deps));
  queue = run.catch(() => {});
  return run;
}

async function processMessage(message, deps) {
  if (!message?.guild || message.author?.bot) return;
  if (message.channelId !== kegiatanChannelId()) return;

  const parsed = parseKegiatanText(message.content);
  if (!parsed.isAttempt) return;

  const member = await message.guild.members.fetch(message.author.id).catch(() => null);
  if (!deps.isAllowedMember(member)) {
    await message.react("⛔").catch(() => {});
    return;
  }

  if (parsed.problems?.length) {
    await fail(message, parsed.problems.join("\n• "));
    return;
  }

  try {
    const existing = await findByMessage(message.id);
    const { participants, notes } = await resolveParticipants(parsed.data.participants);
    if (notes.length) console.log(`[kegiatan] catatan peserta: ${notes.join("; ")}`);

    const body = {
      title: parsed.data.title,
      negotiation: parsed.data.negotiation,
      activityDate: parsed.data.activityDate,
      participants,
    };

    if (existing) {
      await api(`/api/activities/${existing.id}`, { method: "PATCH", body });
      console.log(`[kegiatan] ${existing.code} diperbarui oleh ${message.author.username}`);
    } else {
      const { data } = await api("/api/activities", {
        method: "POST",
        body: {
          ...body,
          createdBy: `discord:${message.author.username}`.slice(0, 100),
          discordMessageId: message.id,
        },
      });
      console.log(
        `[kegiatan] ${data.code} dicatat (${data.participants.length} peserta) oleh ${message.author.username}`,
      );
    }
    await message.react("✅").catch(() => {});
  } catch (err) {
    // 409 bisa berarti pesan ini sudah tercatat (mis. dua event beruntun).
    // Pastikan dulu lewat pencarian, jangan asal anggap sukses.
    if (err instanceof ApiError && err.status === 409) {
      const again = await findByMessage(message.id).catch(() => null);
      if (again) {
        await message.react("✅").catch(() => {});
        return;
      }
    }
    console.error(`[kegiatan] gagal memproses pesan ${message.id}:`, describe(err));
    await fail(message, describe(err));
  }
}

// ---------- /kegiatan rekap ----------

function monthStartWib() {
  const [y, m] = new Intl.DateTimeFormat("en-CA", {
    timeZone: WIB,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .split("-");
  return `${y}-${m}-01`;
}

async function rekap() {
  const from = monthStartWib();
  const [{ data: stats }, { data, meta }] = await Promise.all([
    api("/api/activities/stats"),
    api(`/api/activities?from=${from}&pageSize=10`),
  ]);

  const monthLabel = new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: WIB,
  }).format(new Date());

  const embed = new EmbedBuilder()
    .setColor(0x10b981)
    .setTitle(`Rekap Kegiatan — ${monthLabel}`)
    .addFields(
      { name: "Kegiatan bulan ini", value: String(stats.kegiatanBulanIni), inline: true },
      { name: "Peserta bulan ini", value: String(stats.pesertaBulanIni), inline: true },
      { name: "Total kegiatan", value: String(stats.total), inline: true },
    );

  if (data.length === 0) {
    embed.setDescription("Belum ada kegiatan bulan ini.");
  } else {
    embed.setDescription(
      data
        .map(
          (a) =>
            `📅 **${fmtDate(a.activityDate)}** · ${escapeMd(a.title)} · ${a.participants.length} peserta`,
        )
        .join("\n"),
    );
    embed.setFooter({
      text:
        meta.total > 10
          ? `Menampilkan 10 dari ${meta.total} kegiatan bulan ini`
          : `${meta.total} kegiatan bulan ini`,
    });
  }

  return { reply: { embeds: [embed] } };
}

export async function handleKegiatanCommand(interaction) {
  const sub = interaction.options.getSubcommand();
  if (sub === "rekap") return rekap();
}
