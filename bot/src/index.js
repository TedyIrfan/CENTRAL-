import {
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  MessageFlags,
  PermissionFlagsBits,
} from "discord.js";
import { actorOf, api, describeError, UserError } from "./api.js";
import { canEditStruktur } from "./access.js";
import { CONTEXT_ADD_NAME, commands } from "./commands.js";
import { handleAddButton, handleContextAdd } from "./tambah.js";
import { buildDeleteConfirm, handleDeleteButton } from "./hapus.js";
import { handleRegistrationMessage } from "./daftar.js";
import { STATUS, escapeMd } from "./format.js";
import { handleKegiatanCommand, handleKegiatanMessage, kegiatanChannelId } from "./kegiatan.js";
import { refreshStruktur, structureLink } from "./struktur.js";
import { handleWd, handleWdButton, handleWdModal, syncWdCards, syncWdReminders, wdChannelId } from "./wd.js";
import { handleWdMessage } from "./wd-message.js";

const { DISCORD_TOKEN, DISCORD_GUILD_ID, STRUKTUR_CHANNEL_ID } = process.env;
for (const [k, v] of Object.entries({ DISCORD_TOKEN, DISCORD_GUILD_ID, STRUKTUR_CHANNEL_ID })) {
  if (!v) {
    console.error(`Env ${k} belum diisi`);
    process.exit(1);
  }
}

const csv = (v) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const ALLOWED_ROLES = csv(process.env.ALLOWED_ROLE_IDS);
const ALLOWED_USERS = csv(process.env.ALLOWED_USER_IDS);
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID || null;
const REFRESH_MS = 5 * 60_000;

// Pengingat "PENGEMBALIAN TERLAMBAT" di channel WD: MATI secara default (16 Nov 2026).
// Nyalakan lagi dengan WD_REMINDER_ENABLED=1 di .env kalau nanti dibutuhkan.
const WD_REMINDER_ENABLED = process.env.WD_REMINDER_ENABLED === "1";

// Channel pendaftaran otomatis: pesan berformat langsung masuk database.
const DAFTAR_CHANNEL_ID = process.env.DAFTAR_CHANNEL_ID || null;

// Channel WD: kartu pengambilan/pengembalian + auto-catat format dari chat.
if (!wdChannelId()) {
  console.warn("[wd] WD_CHANNEL_ID belum diisi — kartu & auto-catat WD nonaktif.");
} else {
  console.log(`[wd] kartu & auto-catat WD aktif di channel ${wdChannelId()}`);
}

// Channel kegiatan: pesan berformat baku langsung dicatat & diberi reaksi ✅.
if (!kegiatanChannelId()) {
  console.warn("[kegiatan] KEGIATAN_CHANNEL_ID belum diisi — auto-catat kegiatan nonaktif.");
} else {
  console.log(`[kegiatan] auto-catat aktif di channel ${kegiatanChannelId()}`);
}

// Catatan: field `flags` di /applications/@me tidak bisa diandalkan untuk intent ini
// (pernah dilaporkan "limited" padahal sudah aktif dan gateway menerima). Jadi selama
// DAFTAR_CHANNEL_ID diisi, kita minta intent-nya; kalau Discord menolak, error-nya jelas.
const intents = [GatewayIntentBits.Guilds];
if (DAFTAR_CHANNEL_ID || kegiatanChannelId() || wdChannelId()) {
  intents.push(GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent);
  if (DAFTAR_CHANNEL_ID) console.log(`[daftar] auto-daftar aktif di channel ${DAFTAR_CHANNEL_ID}`);  if (kegiatanChannelId()) console.log(`[kegiatan] channel kegiatan ${kegiatanChannelId()}`);
  if (wdChannelId()) console.log(`[wd] auto-catat WD di channel ${wdChannelId()}`);
}

const client = new Client({ intents });

function isAllowed(interaction) {
  if (ALLOWED_USERS.includes(interaction.user.id)) return true;
  const perms = interaction.memberPermissions;
  if (perms?.has(PermissionFlagsBits.Administrator) || perms?.has(PermissionFlagsBits.ManageGuild)) return true;
  const roles = interaction.member?.roles?.cache;
  return Boolean(roles && ALLOWED_ROLES.some((id) => roles.has(id)));
}

/** Versi isAllowed untuk objek GuildMember (dipakai alur baca pesan channel). */
function isAllowedMember(member) {
  if (!member) return false;
  if (ALLOWED_USERS.includes(member.id)) return true;
  const perms = member.permissions;
  if (perms?.has(PermissionFlagsBits.Administrator) || perms?.has(PermissionFlagsBits.ManageGuild)) return true;
  const roles = member.roles?.cache;
  return Boolean(roles && ALLOWED_ROLES.some((id) => roles.has(id)));
}

/**
 * Pagar khusus aksi tulis di channel struktur: hanya role ALLOWED_ROLE_IDS (BIG HOMIES)
 * atau Administrator/Manage Server. Berbeda dari isAllowedMember, daftar ALLOWED_USER_IDS
 * tidak berlaku di sini.
 */
function isStrukturEditor(member) {
  return canEditStruktur(
    {
      isAdmin: member?.permissions?.has(PermissionFlagsBits.Administrator),
      isManageGuild: member?.permissions?.has(PermissionFlagsBits.ManageGuild),
      roleIds: member?.roles?.cache ? [...member.roles.cache.keys()] : [],
    },
    ALLOWED_ROLES,
  );
}


/** Nama di autocomplete bernilai ID anggota; kalau diketik manual, cocokkan lewat pencarian. */
async function resolveMemberId(input) {
  if (/^\d{1,10}$/.test(input)) return Number(input);
  const { data } = await api(`/api/members?search=${encodeURIComponent(input)}&pageSize=10`);
  const exact = data.filter((m) => m.name.toLowerCase() === input.trim().toLowerCase());
  if (exact.length === 1) return exact[0].id;
  if (data.length === 1) return data[0].id;
  if (data.length === 0) throw new UserError(`Anggota "${input}" tidak ditemukan.`);
  throw new UserError(
    `Ada ${data.length} anggota yang cocok dengan "${input}". Pilih dari daftar saran saat mengetik nama.`,
  );
}

async function resolvePositionId(input) {
  if (/^\d{1,10}$/.test(input)) return Number(input);
  const { data } = await api("/api/positions");
  const found = data.find((p) => p.name.toLowerCase() === input.trim().toLowerCase());
  if (!found) throw new UserError(`Jabatan "${input}" tidak ditemukan. Pilih dari daftar saran.`);
  return found.id;
}

function memberEmbed(m, title) {
  return new EmbedBuilder()
    .setColor(0xffffff)
    .setTitle(title ?? m.name)
    .addFields(
      { name: "Nama", value: escapeMd(m.name), inline: true },
      { name: "Jabatan", value: m.position.name, inline: true },
      { name: "Status", value: `${STATUS[m.status].emoji} ${STATUS[m.status].label}`, inline: true },
      { name: "Steam Hex", value: m.hex ? `\`${m.hex}\`` : "—", inline: true },
      { name: "ID Discord", value: m.discordId ? `<@${m.discordId}>` : "—", inline: true },
    );
}

async function sendLog(interaction, description) {
  if (!LOG_CHANNEL_ID) return;
  try {
    const channel = await client.channels.fetch(LOG_CHANNEL_ID);
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0x71717a)
          .setDescription(description)
          .setFooter({ text: `oleh ${interaction.user.tag}` })
          .setTimestamp(),
      ],
    });
  } catch (err) {
    console.error("[log] gagal kirim log:", err.message);
  }
}

// ---------- handler command ----------

async function handleAnggota(interaction) {
  const sub = interaction.options.getSubcommand();
  // Dipakai semua mutasi di bawah supaya riwayat di web mencatat pelakunya.
  const actor = actorOf(interaction.user, interaction.member?.displayName);

  if (sub === "cari") {
    const q = interaction.options.getString("nama", true);
    const asId = /^\d{1,10}$/.test(q);
    if (asId) {
      const { data } = await api(`/api/members/${q}`);
      await interaction.editReply({ embeds: [memberEmbed(data)] });
      return null;
    }
    const { data, meta } = await api(`/api/members?search=${encodeURIComponent(q)}&pageSize=10`);
    if (data.length === 0) {
      await interaction.editReply(`Tidak ada anggota yang cocok dengan "${q}".`);
      return null;
    }
    if (data.length === 1) {
      await interaction.editReply({ embeds: [memberEmbed(data[0])] });
      return null;
    }
    const lines = data.map(
      (m) => `${STATUS[m.status].emoji} **${escapeMd(m.name)}** — ${m.position.name}${m.hex ? ` — \`${m.hex}\`` : ""}`,
    );
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xffffff)
          .setTitle(`Hasil pencarian "${q}"`)
          .setDescription(lines.join("\n"))
          .setFooter({ text: meta.total > 10 ? `Menampilkan 10 dari ${meta.total}` : `${meta.total} hasil` }),
      ],
    });
    return null;
  }

  if (sub === "tambah") {
    const positionId = await resolvePositionId(interaction.options.getString("jabatan", true));
    const body = { name: interaction.options.getString("nama", true), positionId };
    const hex = interaction.options.getString("hex");
    const status = interaction.options.getString("status");
    if (hex) body.hex = hex;
    if (status) body.status = status;
    const { data } = await api("/api/members", { method: "POST", body, actor });
    await sendLog(interaction, `➕ **${escapeMd(data.name)}** ditambahkan ke **${data.position.name}**`);
    return { reply: { embeds: [memberEmbed(data, "Anggota ditambahkan")] } };
  }

  if (sub === "ubah") {
    const id = await resolveMemberId(interaction.options.getString("nama", true));
    const body = {};
    const namaBaru = interaction.options.getString("nama_baru");
    const hex = interaction.options.getString("hex");
    const discord = interaction.options.getString("discord");
    const status = interaction.options.getString("status");

    if (namaBaru !== null) body.name = namaBaru;
    if (hex !== null) body.hex = hex.trim() === "-" ? null : hex;
    if (discord !== null) body.discordId = discord.trim() === "-" ? null : discord;
    if (status !== null) body.status = status;

    if (Object.keys(body).length === 0) {
      throw new UserError("Isi minimal satu kolom yang mau diubah: nama_baru, hex, discord, atau status.");
    }
    const { data } = await api(`/api/members/${id}`, { method: "PATCH", body, actor });
    await sendLog(interaction, `✏️ **${escapeMd(data.name)}** diperbarui`);
    return { reply: { embeds: [memberEmbed(data, "Data anggota diperbarui")] } };
  }

  if (sub === "pindah") {
    const id = await resolveMemberId(interaction.options.getString("nama", true));
    const positionId = await resolvePositionId(interaction.options.getString("jabatan", true));
    const before = (await api(`/api/members/${id}`)).data;
    if (before.position.id === positionId) {
      throw new UserError(`"${before.name}" sudah di jabatan ${before.position.name}.`);
    }
    const { data } = await api(`/api/members/${id}`, { method: "PATCH", body: { positionId }, actor });
    await sendLog(
      interaction,
      `↔️ **${escapeMd(data.name)}** pindah dari **${before.position.name}** ke **${data.position.name}** (status ${data.status})`,
    );
    return { reply: { embeds: [memberEmbed(data, `${data.name} → ${data.position.name}`)] } };
  }

  if (sub === "hapus") {
    const id = await resolveMemberId(interaction.options.getString("nama", true));
    const { data } = await api(`/api/members/${id}`);
    return { reply: buildDeleteConfirm(interaction, data) };
  }

  const id = await resolveMemberId(interaction.options.getString("nama", true));

  if (sub === "naik" || sub === "turun") {
    const { data } = await api(`/api/members/${id}/${sub === "naik" ? "promote" : "demote"}`, { method: "POST", actor });
    const icon = sub === "naik" ? "▲" : "▼";
    const verb = sub === "naik" ? "naik" : "turun";
    await sendLog(
      interaction,
      `${icon} **${escapeMd(data.name)}** ${verb} dari **${data.previousPosition}** ke **${data.position.name}**`,
    );
    return { reply: { embeds: [memberEmbed(data, `${icon} ${data.name} ${verb} ke ${data.position.name}`)] } };
  }

  if (sub === "status") {
    const before = (await api(`/api/members/${id}`)).data;
    const { data } = await api(`/api/members/${id}`, {
      method: "PATCH",
      body: { status: interaction.options.getString("status", true) },
      actor,
    });
    const moved = data.position.id !== before.position.id;
    await sendLog(
      interaction,
      `🔁 Status **${escapeMd(data.name)}**: ${STATUS[before.status].label} → **${STATUS[data.status].label}**` +
        (moved ? ` (jabatan turun dari **${before.position.name}** ke **${data.position.name}**)` : ""),
    );
    return { reply: { embeds: [memberEmbed(data, "Status diperbarui")] } };
  }

  if (sub === "hex") {
    const raw = interaction.options.getString("hex", true).trim();
    const { data } = await api(`/api/members/${id}`, {
      method: "PATCH",
      body: { hex: raw === "-" ? null : raw },
      actor,
    });
    await sendLog(interaction, `🆔 Steam Hex **${escapeMd(data.name)}** diperbarui`);
    return { reply: { embeds: [memberEmbed(data, "Steam Hex diperbarui")] } };
  }
}

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isAutocomplete()) return await handleAutocomplete(interaction);

    if (interaction.isMessageContextMenuCommand()) {
      if (interaction.commandName !== CONTEXT_ADD_NAME) return;
      if (!isAllowed(interaction)) {
        return interaction.reply({
          content: "⛔ Kamu tidak punya izin memakai command ini.",
          flags: MessageFlags.Ephemeral,
        });
      }
      return await handleContextAdd(interaction);
    }

    if (interaction.isButton()) {
      const isAdd = /^addx?\|/.test(interaction.customId);
      const isDelete = /^delx?\|/.test(interaction.customId);
      const isWd = /^wd(ret|hil)\|/.test(interaction.customId);
      if (!isAdd && !isDelete && !isWd) return;
      if (!isAllowed(interaction)) {
        return interaction.reply({
          content: "⛔ Kamu tidak punya izin.",
          flags: MessageFlags.Ephemeral,
        });
      }
      if (isWd) return await handleWdButton(interaction);
      if (isDelete) {
        return await handleDeleteButton(interaction, {
          sendLog,
          refreshStruktur: () => refreshStruktur(client),
        });
      }
      return await handleAddButton(interaction, {
        memberEmbed,
        sendLog,
        refreshStruktur: () => refreshStruktur(client),
      });
    }

    if (interaction.isModalSubmit()) {
      if (!/^wd(ret|hil)sub\|/.test(interaction.customId)) return;
      if (!isAllowed(interaction)) {
        return interaction.reply({
          content: "⛔ Kamu tidak punya izin.",
          flags: MessageFlags.Ephemeral,
        });
      }
      return await handleWdModal(interaction, { client, sendLog });
    }

    if (!interaction.isChatInputCommand()) return;

    if (!isAllowed(interaction)) {
      return interaction.reply({
        content: "⛔ Kamu tidak punya izin memakai command ini.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const isWdCommand = interaction.commandName === "wd";
    const isKegiatanCommand = interaction.commandName === "kegiatan";
    const sub =
      interaction.commandName === "anggota" || isWdCommand || isKegiatanCommand
        ? interaction.options.getSubcommand()
        : null;
    // cari & hapus bersifat privat (ephemeral); command lain tampil di channel.
    // Semua command WD privat: kartunya sudah tampil publik di channel WD.
    const isPrivate = isWdCommand || sub === "cari" || sub === "hapus";
    await interaction.deferReply(isPrivate ? { flags: MessageFlags.Ephemeral } : {});

    let result;
    if (interaction.commandName === "struktur") {
      await refreshStruktur(client, { force: true });
      return await interaction.editReply(`✅ Struktur diperbarui: ${structureLink()}`);
    }
    if (isWdCommand) {
      result = await handleWd(interaction, { client, resolveMemberId, sendLog });
    } else if (isKegiatanCommand) {
      result = await handleKegiatanCommand(interaction);
    } else {
      result = await handleAnggota(interaction);
    }

    if (result?.reply) {
      await interaction.editReply(result.reply);
      if (!isWdCommand && !isKegiatanCommand) refreshStruktur(client);
    }
  } catch (err) {
    const message = err instanceof UserError ? err.message : describeError(err);
    if (interaction.isAutocomplete()) return;
    if (interaction.deferred && !interaction.ephemeral) {
      await interaction.deleteReply().catch(() => {});
      await interaction.followUp({ content: `❌ ${message}`, flags: MessageFlags.Ephemeral }).catch(() => {});
    } else if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: `❌ ${message}` }).catch(() => {});
    } else {
      await interaction.reply({ content: `❌ ${message}`, flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  }
});

async function handleAutocomplete(interaction) {
  const started = Date.now();
  const age = started - interaction.createdTimestamp;
  if (!isAllowed(interaction)) return interaction.respond([]);
  const focused = interaction.options.getFocused(true);
  const text = String(focused.value ?? "").trim();
  let choices = [];

  try {
    if (focused.name === "jabatan") {
      const { data } = await api("/api/positions");
      choices = data
        .filter((p) => p.name.toLowerCase().includes(text.toLowerCase()))
        .map((p) => ({ name: p.name, value: String(p.id) }));
    } else if (focused.name === "barang") {
      const { data } = await api("/api/wd/items");
      choices = data
        .filter((name) => name.toLowerCase().includes(text.toLowerCase()))
        .slice(0, 25)
        .map((name) => ({ name: name.slice(0, 100), value: name.slice(0, 100) }));
    } else if (focused.name === "kode") {
      const { data } = await api(
        `/api/wd?status=DIPINJAM&search=${encodeURIComponent(text)}&pageSize=25`,
      );
      choices = data.map((r) => ({
        name: `${r.code} — ${r.borrowerName.replace(/^CT - /, "")} — ${r.itemName}`.slice(0, 100),
        value: String(r.id),
      }));
    } else {
      const { data } = await api(`/api/members?search=${encodeURIComponent(text)}&pageSize=25`);
      choices = data.map((m) => ({
        name: `${m.name} — ${m.position.name}`.slice(0, 100),
        value: String(m.id),
      }));
    }
  } catch {
    choices = [];
  }
  try {
    await interaction.respond(choices.slice(0, 25));
  } catch (err) {
    if (err.code !== 10062) throw err;
    console.warn(
      `[autocomplete] terlambat: event tiba ${age}ms setelah dibuat, diproses ${Date.now() - started}ms`,
    );
  }
}

client.once(Events.ClientReady, async (c) => {
  console.log(`[bot] login sebagai ${c.user.tag}`);
  // Daftarkan command di SEMUA server yang diikuti bot, bukan cuma DISCORD_GUILD_ID,
  // supaya command langsung muncul di server lain tanpa menunggu propagasi command global.
  await c.guilds.fetch().catch(() => {});
  const guilds = [...c.guilds.cache.values()];
  for (const guild of guilds) {
    try {
      await guild.commands.set(commands);
      console.log(`[bot] ${commands.length} command terdaftar di server "${guild.name}"`);
    } catch (err) {
      console.error(`[bot] gagal mendaftarkan command di "${guild.name}":`, err.message);
    }
  }
  console.log(`[bot] total ${guilds.length} server`);
  refreshStruktur(c, { force: true });
  syncWdCards(c, { force: true });
  if (WD_REMINDER_ENABLED) {
    syncWdReminders(c);
  } else {
    console.log("[wd] pengingat terlambat nonaktif (WD_REMINDER_ENABLED != 1)");
  }
  setInterval(() => refreshStruktur(c), REFRESH_MS);
  // Perubahan dari web (kembali/hilang/edit) ikut tampil di kartu Discord.
  setInterval(() => syncWdCards(c), 2 * 60_000);
  // Pengingat senjata yang melewati tenggat 3 hari — hanya kalau diaktifkan.
  if (WD_REMINDER_ENABLED) {
    setInterval(() => syncWdReminders(c), 30 * 60_000);
  }
});

// Auto-catat kegiatan: pesan berformat TANGGAL KEGIATAN / KEGIATAN / NEGOSIASI / NAMA ANGGOTA
// di channel kegiatan langsung disimpan, lalu pesannya diberi reaksi ✅.
// Pesan yang diedit mengubah data yang sama (tidak membuat baris baru).
client.on(Events.MessageCreate, async (message) => {
  if (wdChannelId() && message.channelId === wdChannelId()) {
    try {
      await handleWdMessage(message, {
        isAllowedMember,
        onChanged: () => syncWdCards(client),
      });
    } catch (err) {
      console.error("[wd] error:", err.message ?? err);
      await message.react("⚠️").catch(() => {});
    }
    return;
  }

  if (kegiatanChannelId() && message.channelId === kegiatanChannelId()) {
    try {
      await handleKegiatanMessage(message, { isAllowedMember });
    } catch (err) {
      console.error("[kegiatan] error:", err.message ?? err);
      await message.react("⚠️").catch(() => {});
    }
    return;
  }

  if (!DAFTAR_CHANNEL_ID) return;
  if (message.channelId !== DAFTAR_CHANNEL_ID) return;
  try {
    await handleRegistrationMessage(message, {
      // Channel struktur memakai pagar lebih ketat: role BIG HOMIES atau Administrator.
      // ALLOWED_USER_IDS sengaja tidak berlaku di sini (lihat bot/src/access.js).
      isAllowedMember: isStrukturEditor,
      refreshStruktur: () => refreshStruktur(client),
    });
  } catch (err) {
    console.error("[daftar] error:", err.message ?? err);
    await message.react("⚠️").catch(() => {});
  }
});

// Edit pesan format WD = coba proses ulang (hanya jika belum pernah ditandai ✅).
client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
  if (!wdChannelId() || newMessage.channelId !== wdChannelId()) return;
  if ((oldMessage.content ?? "") === (newMessage.content ?? "")) return;
  const message = newMessage.partial ? await newMessage.fetch().catch(() => null) : newMessage;
  if (!message) return;
  try {
    await handleWdMessage(message, {
      isAllowedMember,
      onChanged: () => syncWdCards(client),
    });
  } catch (err) {
    console.error("[wd] error saat edit:", err.message ?? err);
    await message.react("⚠️").catch(() => {});
  }
});

// Edit pesan di channel kegiatan = edit kegiatan yang sudah tercatat.
client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
  if (!kegiatanChannelId() || newMessage.channelId !== kegiatanChannelId()) return;
  if ((oldMessage.content ?? "") === (newMessage.content ?? "")) return;
  const message = newMessage.partial ? await newMessage.fetch().catch(() => null) : newMessage;
  if (!message) return;
  try {
    await handleKegiatanMessage(message, { isAllowedMember });
  } catch (err) {
    console.error("[kegiatan] error saat edit:", err.message ?? err);
    await message.react("⚠️").catch(() => {});
  }
});

client.on(Events.Error, (err) => console.error("[bot] error:", err.message));
process.on("unhandledRejection", (err) => console.error("[bot] unhandledRejection:", err));

client.login(DISCORD_TOKEN).catch((err) => {
  console.error("[bot] gagal login:", err.message);
  if (/disallowed|4014/i.test(String(err.message))) {
    console.error(
      "[bot] kemungkinan Message Content Intent dimatikan di Developer Portal " +
        "(Applications -> Bot -> Privileged Gateway Intents).",
    );
  }
  process.exit(1);
});
