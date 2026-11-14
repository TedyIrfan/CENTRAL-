import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { api, describeError, UserError } from "./api.js";
import { escapeMd } from "./format.js";

/** Penanda footer kartu WD — dipakai untuk mengenali kartu milik bot ini. */
export const WD_MARKER = "CT-WD";

const WIB = "Asia/Jakarta";

const WD_STATUS = {
  DIPINJAM: { label: "Dipinjam", emoji: "🟡", color: 0xf59e0b },
  DIKEMBALIKAN: { label: "Dikembalikan", emoji: "🟢", color: 0x10b981 },
  HILANG: { label: "Hilang", emoji: "🔴", color: 0xf43f5e },
};

// ---------- format ----------

/** Tanggal hari ini (WIB) -> YYYY-MM-DD. */
export function todayWib() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: WIB,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function fmtDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : "—";
}

const fmtDurab = (v) => (v === null || v === undefined ? "—" : `${v} %`);

/** Teks format baku WD (sama dengan tombol "Salin format" di web). */
export function formatWdText(r) {
  return [
    "FORMAT PENGAMBILAN & PENGEMBALIAN BARANG",
    `TGL PENGAMBILAN   : ${fmtDate(r.takenAt)}`,
    `TGL PENGEMBALIAN  : ${fmtDate(r.returnedAt)}`,
    `NAMA              : ${r.borrowerName}`,
    `JENIS BARANG      : ${r.itemName}`,
    `SN                : ${r.serialNumber ?? "—"}`,
    `DURAB AWAL        : ${fmtDurab(r.durabilityStart)}`,
    `DURAB DIKEMBALIKAN: ${fmtDurab(r.durabilityReturn)}`,
    `QTY               : ${r.qty} PCS`,
    `KEPERLUAN         : ${r.purpose}`,
  ].join("\n");
}

/** Embed kartu WD: format baku + status, catatan kondisi / alasan hilang. */
export function wdEmbed(r, title) {
  const status = WD_STATUS[r.status] ?? WD_STATUS.DIPINJAM;
  const embed = new EmbedBuilder()
    .setColor(status.color)
    .setTitle(title ?? `${r.code} • ${r.itemName}`)
    .setDescription("```\n" + formatWdText(r) + "\n```")
    .setFooter({ text: `${WD_MARKER} • ${status.emoji} ${status.label}` });

  if (r.returnNote) embed.addFields({ name: "Catatan kondisi", value: String(r.returnNote).slice(0, 1024) });
  if (r.lostReason) embed.addFields({ name: "Alasan hilang", value: String(r.lostReason).slice(0, 1024) });
  return embed;
}

/** Tombol aksi hanya muncul selama barang masih dipinjam. */
function cardComponents(r) {
  if (r.status !== "DIPINJAM") return [];
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`wdret|${r.id}`)
        .setLabel("Kembalikan")
        .setEmoji("✅")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`wdhil|${r.id}`)
        .setLabel("Tandai hilang")
        .setEmoji("⚠️")
        .setStyle(ButtonStyle.Danger),
    ),
  ];
}

// ---------- kartu di channel WD ----------

export function wdChannelId() {
  return process.env.WD_CHANNEL_ID || null;
}

export function wdLink() {
  const guild = process.env.DISCORD_GUILD_ID;
  const channel = wdChannelId();
  return `https://discord.com/channels/${guild}/${channel}`;
}

async function fetchMessageById(client, messageId) {
  const channelId = wdChannelId();
  if (!channelId || !messageId) return null;
  const channel = await client.channels.fetch(channelId);
  return channel.messages.fetch(messageId).catch(() => null);
}

/** Kirim kartu baru lalu simpan message id-nya di database (kolom discord_message_id). */
export async function postWdCard(client, record) {
  const channelId = wdChannelId();
  if (!channelId) return null;
  const channel = await client.channels.fetch(channelId);
  const msg = await channel.send({ embeds: [wdEmbed(record)], components: cardComponents(record) });
  await api(`/api/wd/${record.id}/discord-message`, { method: "POST", body: { messageId: msg.id } });
  return msg;
}

/** Edit kartu agar isinya sesuai database (tanpa mengirim pesan baru). */
export async function refreshWdCard(client, record, msg) {
  const message = msg ?? (await fetchMessageById(client, record?.discordMessageId));
  if (!message) return false;
  const payload = { embeds: [wdEmbed(record)], components: cardComponents(record) };
  const sameEmbeds =
    JSON.stringify(message.embeds.map((e) => e.toJSON())) ===
    JSON.stringify(payload.embeds.map((e) => e.toJSON()));
  const sameComponents =
    JSON.stringify(message.components.map((c) => c.toJSON())) ===
    JSON.stringify(payload.components.map((c) => c.toJSON()));
  if (sameEmbeds && sameComponents) return false;
  await message.edit(payload);
  return true;
}

/** Status yang tertulis di footer kartu, mis. "CT-WD • 🟡 Dipinjam" -> "DIPINJAM". */
function cardStatus(message) {
  const footer = message?.embeds?.[0]?.footer?.text ?? "";
  return Object.keys(WD_STATUS).find((key) => footer.includes(WD_STATUS[key].label)) ?? null;
}

/**
 * Pengembalian/hilang = pesan BARU dengan format yang sama, isinya sudah terisi
 * tanggal & durab kembali. Kartu pengambilan lama dibiarkan apa adanya,
 * hanya tombolnya dicabut supaya tidak diklik dua kali.
 */
export async function publishResultCard(client, record) {
  const oldId = record.discordMessageId;
  if (oldId) {
    const old = await fetchMessageById(client, oldId);
    if (old) await old.edit({ components: [] }).catch((err) => console.error("[wd] gagal cabut tombol:", err.message));
  }
  return postWdCard(client, record);
}

// ---------- sinkronisasi web -> Discord ----------

let syncQueue = Promise.resolve();
let lastSync = new Date(Date.now() - 5 * 60_000).toISOString();

/**
 * Ambil transaksi yang berubah sejak sinkronisasi terakhir lalu edit kartunya.
 * Dengan begitu perubahan yang dibuat dari web (kembali/hilang/edit) ikut tampil di Discord.
 */
export function syncWdCards(client, { force = false } = {}) {
  syncQueue = syncQueue
    .then(() => doSync(client, force))
    .catch((err) => console.error("[wd] gagal sinkron kartu:", err.message ?? err));
  return syncQueue;
}

async function doSync(client, force) {
  if (!wdChannelId()) return;
  const since = force ? new Date(Date.now() - 60 * 60_000).toISOString() : lastSync;
  const { data } = await api(`/api/wd?updatedAfter=${encodeURIComponent(since)}&pageSize=100`);
  lastSync = new Date(Date.now() - 60_000).toISOString();
  let edited = 0;
  for (const record of data) {
    if (!record.discordMessageId) continue;
    try {
      const msg = await fetchMessageById(client, record.discordMessageId);
      if (!msg) continue;
      const onCard = cardStatus(msg);
      if (record.status === "DIPINJAM") {
        if (await refreshWdCard(client, record, msg)) edited += 1;
      } else if (onCard === record.status) {
        if (await refreshWdCard(client, record, msg)) edited += 1;
      } else {
        // Kartu pengambilan masih "Dipinjam" tapi transaksi sudah kembali/hilang
        // (mis. diubah dari web): kirim kartu pengembalian baru.
        await publishResultCard(client, record);
        edited += 1;
      }
    } catch (err) {
      console.error(`[wd] gagal sinkron kartu ${record.code}:`, err.message ?? err);
    }
  }
  if (edited) console.log(`[wd] ${edited} kartu diperbarui`);
}

// ---------- resolusi & validasi ----------

/** Terima ID numerik (dari autocomplete) atau kode/nama transaksi yang diketik manual. */
export async function resolveWdId(input, { dipinjamOnly = true } = {}) {
  const text = String(input).trim();
  if (/^\d{1,10}$/.test(text)) return Number(text);
  const qs = new URLSearchParams({ search: text, pageSize: "10" });
  if (dipinjamOnly) qs.set("status", "DIPINJAM");
  const { data } = await api(`/api/wd?${qs}`);
  const exact = data.find((r) => r.code.toLowerCase() === text.toLowerCase());
  if (exact) return exact.id;
  if (data.length === 1) return data[0].id;
  if (data.length === 0) {
    throw new UserError(
      `Transaksi "${text}" tidak ditemukan${dipinjamOnly ? " atau sudah tidak dipinjam" : ""}.`,
    );
  }
  throw new UserError(
    `Ada ${data.length} transaksi yang cocok dengan "${text}". Pilih kode dari daftar saran.`,
  );
}

async function getWd(id) {
  const { data } = await api(`/api/wd/${id}`);
  return data;
}

function assertDateInput(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new UserError("Tanggal harus format YYYY-MM-DD, contoh 2026-11-14.");
  }
  return text;
}

// ---------- modal & tombol ----------

function returnModal(record) {
  const modal = new ModalBuilder()
    .setCustomId(`wdretsub|${record.id}`)
    .setTitle(`Kembalikan ${record.code}`.slice(0, 45));
  if (record.isWeapon) {
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("durab")
          .setLabel("Durab dikembalikan (0-100, boleh sama)")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(3)
          .setValue(record.durabilityStart !== null ? String(record.durabilityStart) : "100"),
      ),
    );
  }
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("catatan")
        .setLabel("Catatan kondisi (opsional)")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(500),
    ),
  );
  return modal;
}

function lostModal(record) {
  return new ModalBuilder()
    .setCustomId(`wdhilsub|${record.id}`)
    .setTitle(`Tandai hilang ${record.code}`.slice(0, 45))
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("alasan")
          .setLabel("Alasan hilang (wajib)")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(500),
      ),
    );
}

/** Tombol ✅ Kembalikan / ⚠️ Tandai hilang pada kartu WD. */
export async function handleWdButton(interaction) {
  const [action, idRaw] = interaction.customId.split("|");
  const id = Number(idRaw);
  if (!Number.isInteger(id) || id <= 0) return;

  const record = await getWd(id);
  if (record.status !== "DIPINJAM") {
    return interaction.reply({
      content: `Transaksi ${record.code} sudah ${WD_STATUS[record.status]?.label ?? record.status}.`,
      flags: MessageFlags.Ephemeral,
    });
  }
  return interaction.showModal(action === "wdhil" ? lostModal(record) : returnModal(record));
}

/** Submit modal kembali / hilang. */
export async function handleWdModal(interaction, deps) {
  const [action, idRaw] = interaction.customId.split("|");
  const id = Number(idRaw);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    if (action === "wdretsub") {
      const body = {};
      if (interaction.fields.fields.has("durab")) {
        const raw = interaction.fields.getTextInputValue("durab").trim();
        const value = Number(raw);
        if (!/^\d{1,3}$/.test(raw) || value > 100) throw new UserError("Durab harus bilangan bulat 0-100.");
        body.durabilityReturn = value;
      }
      if (interaction.fields.fields.has("catatan")) {
        const note = interaction.fields.getTextInputValue("catatan").trim();
        if (note) body.returnNote = note;
      }
      const { data } = await api(`/api/wd/${id}/return`, { method: "POST", body });
      const card = await publishResultCard(deps.client, data).catch((err) => {
        console.error("[wd] gagal kirim kartu kembali:", err.message ?? err);
        return null;
      });
      await deps.sendLog(interaction, `↩️ **${data.code}** — ${escapeMd(data.borrowerName)} mengembalikan **${escapeMd(data.itemName)}**`);
      return interaction.editReply({
        content: card ? `Kartu pengembalian: ${card.url}` : "Kartu pengembalian gagal dikirim ke channel WD.",
        embeds: [wdEmbed(data, "✅ Barang dikembalikan")],
      });
    }

    if (action === "wdhilsub") {
      const lostReason = interaction.fields.getTextInputValue("alasan").trim();
      const { data } = await api(`/api/wd/${id}/lost`, { method: "POST", body: { lostReason } });
      const card = await publishResultCard(deps.client, data).catch((err) => {
        console.error("[wd] gagal kirim kartu hilang:", err.message ?? err);
        return null;
      });
      await deps.sendLog(interaction, `⚠️ **${data.code}** — ${escapeMd(data.borrowerName)} ditandai **hilang**: ${escapeMd(lostReason)}`);
      return interaction.editReply({
        content: card ? `Kartu hilang: ${card.url}` : "Kartu gagal dikirim ke channel WD.",
        embeds: [wdEmbed(data, "⚠️ Ditandai hilang")],
      });
    }
  } catch (err) {
    return interaction.editReply({ content: `❌ ${err instanceof UserError ? err.message : describeError(err)}` });
  }
}

// ---------- command ----------

async function sendCardSafe(client, record) {
  if (!wdChannelId()) return { card: null, error: "WD_CHANNEL_ID belum diisi" };
  try {
    return { card: await postWdCard(client, record) };
  } catch (err) {
    console.error("[wd] gagal kirim kartu:", err.message ?? err);
    return { card: null, error: describeError(err) };
  }
}

async function handleAmbil(interaction, deps) {
  const memberId = await deps.resolveMemberId(interaction.options.getString("anggota", true));
  const itemName = interaction.options.getString("barang", true).trim();
  const isWeapon = (interaction.options.getString("senjata") ?? "ya") === "ya";
  const sn = interaction.options.getString("sn");
  const durab = interaction.options.getInteger("durab");
  const qty = interaction.options.getInteger("qty") ?? 1;
  const purpose = interaction.options.getString("keperluan", true);
  const tanggal = assertDateInput(interaction.options.getString("tanggal"));

  if (isWeapon && !sn?.trim()) {
    throw new UserError("Senjata wajib punya **serial number** — isi opsi `sn`, atau pilih `senjata: Tidak`.");
  }
  if (isWeapon && durab === null) {
    throw new UserError("Senjata wajib punya **durab awal** — isi opsi `durab` (0-100).");
  }

  const { data } = await api("/api/wd", {
    method: "POST",
    body: {
      memberId,
      itemName,
      isWeapon,
      serialNumber: isWeapon ? sn.trim() : null,
      durabilityStart: isWeapon ? durab : null,
      qty,
      purpose,
      ...(tanggal ? { takenAt: tanggal } : {}),
    },
  });

  const { card, error } = await sendCardSafe(deps.client, data);
  await deps.sendLog(
    interaction,
    `📦 **${data.code}** — ${escapeMd(data.borrowerName)} mengambil **${escapeMd(data.itemName)}**` +
      (data.serialNumber ? ` (SN \`${escapeMd(data.serialNumber)}\`)` : "") +
      ` · qty ${data.qty}`,
  );

  return {
    reply: {
      content: card
        ? `Kartu WD: ${card.url}`
        : `Tercatat di database, tapi **kartu gagal dikirim** ke channel WD (${error}). ` +
          "Data tetap tampil di web; cek izin bot di channel WD.",
      embeds: [wdEmbed(data, "✅ WD tercatat")],
    },
  };
}

async function handleKembali(interaction, deps) {
  const id = await resolveWdId(interaction.options.getString("kode", true));
  const record = await getWd(id);
  if (record.status !== "DIPINJAM") {
    throw new UserError(`${record.code} sudah ${WD_STATUS[record.status]?.label ?? record.status}, tidak bisa dikembalikan lagi.`);
  }

  const durabOption = interaction.options.getInteger("durab");
  const tanggal = assertDateInput(interaction.options.getString("tanggal"));
  const catatan = interaction.options.getString("catatan");

  if (record.isWeapon && durabOption === null && record.durabilityStart === null) {
    throw new UserError("Durab awal transaksi ini kosong — isi opsi `durab` manual.");
  }

  const body = {};
  if (record.isWeapon) body.durabilityReturn = durabOption ?? record.durabilityStart;
  if (tanggal) body.returnedAt = tanggal;
  if (catatan) body.returnNote = catatan;

  const { data } = await api(`/api/wd/${id}/return`, { method: "POST", body });
  const card = await publishResultCard(deps.client, data).catch((err) => {
    console.error("[wd] gagal kirim kartu kembali:", err.message ?? err);
    return null;
  });
  await deps.sendLog(interaction, `↩️ **${data.code}** — ${escapeMd(data.borrowerName)} mengembalikan **${escapeMd(data.itemName)}**`);

  return {
    reply: {
      content: card ? `Kartu pengembalian: ${card.url}` : "Kartu pengembalian gagal dikirim ke channel WD.",
      embeds: [wdEmbed(data, "✅ Barang dikembalikan")],
    },
  };
}

async function handleHilang(interaction, deps) {
  const id = await resolveWdId(interaction.options.getString("kode", true));
  const lostReason = interaction.options.getString("alasan", true).trim();
  const { data } = await api(`/api/wd/${id}/lost`, { method: "POST", body: { lostReason } });
  const card = await publishResultCard(deps.client, data).catch((err) => {
    console.error("[wd] gagal kirim kartu hilang:", err.message ?? err);
    return null;
  });
  await deps.sendLog(
    interaction,
    `⚠️ **${data.code}** — ${escapeMd(data.borrowerName)} ditandai **hilang**: ${escapeMd(lostReason)}`,
  );
  return {
    reply: {
      content: card ? `Kartu hilang: ${card.url}` : "Kartu gagal dikirim ke channel WD.",
      embeds: [wdEmbed(data, "⚠️ Ditandai hilang")],
    },
  };
}

async function handleCari(interaction) {
  const q = interaction.options.getString("kata", true).trim();
  const { data, meta } = await api(`/api/wd?search=${encodeURIComponent(q)}&pageSize=10`);
  if (data.length === 0) {
    return { reply: { content: `Tidak ada transaksi yang cocok dengan "${escapeMd(q)}".` } };
  }
  if (data.length === 1) {
    return { reply: { embeds: [wdEmbed(data[0], "Detail WD")] } };
  }
  const lines = data.map((r) => {
    const s = WD_STATUS[r.status] ?? WD_STATUS.DIPINJAM;
    const sn = r.serialNumber ? ` · \`${escapeMd(r.serialNumber)}\`` : "";
    return `${s.emoji} **${r.code}** — ${escapeMd(r.borrowerName)} — ${escapeMd(r.itemName)}${sn}`;
  });
  const embed = new EmbedBuilder()
    .setColor(0xffffff)
    .setTitle(`Hasil pencarian "${q}"`)
    .setDescription(lines.join("\n"))
    .setFooter({ text: meta.total > 10 ? `Menampilkan 10 dari ${meta.total}` : `${meta.total} hasil` });
  return { reply: { embeds: [embed] } };
}

async function handleDaftar() {
  const { data, meta } = await api("/api/wd?status=DIPINJAM&pageSize=20");
  const embed = new EmbedBuilder().setColor(0xf59e0b).setTitle("WD — Masih dipinjam");
  if (data.length === 0) {
    embed.setDescription("Tidak ada barang yang masih dipinjam. 🎉");
  } else {
    embed.setDescription(
      data
        .map((r) => {
          const sn = r.serialNumber ? ` · \`${escapeMd(r.serialNumber)}\`` : "";
          const dur = r.durabilityStart !== null ? ` · durab ${r.durabilityStart}%` : "";
          return `🟡 **${r.code}** — ${escapeMd(r.borrowerName)} — ${escapeMd(r.itemName)}${sn}${dur}`;
        })
        .join("\n"),
    );
    embed.setFooter({ text: meta.total > 20 ? `Menampilkan 20 dari ${meta.total}` : `${meta.total} transaksi` });
  }
  return { reply: { embeds: [embed] } };
}

export async function handleWd(interaction, deps) {
  const sub = interaction.options.getSubcommand();
  if (sub === "ambil") return handleAmbil(interaction, deps);
  if (sub === "kembali") return handleKembali(interaction, deps);
  if (sub === "hilang") return handleHilang(interaction, deps);
  if (sub === "cari") return handleCari(interaction);
  if (sub === "daftar") return handleDaftar();
}
