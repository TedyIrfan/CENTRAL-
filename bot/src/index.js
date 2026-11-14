import {
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  MessageFlags,
  PermissionFlagsBits,
} from "discord.js";
import { api, describeError, UserError } from "./api.js";
import { CONTEXT_ADD_NAME, commands } from "./commands.js";
import { handleAddButton, handleContextAdd } from "./tambah.js";
import { buildDeleteConfirm, handleDeleteButton } from "./hapus.js";
import { handleRegistrationMessage } from "./daftar.js";
import { STATUS, escapeMd } from "./format.js";
import { refreshStruktur, structureLink } from "./struktur.js";

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

// Channel pendaftaran otomatis: pesan berformat langsung masuk database.
const DAFTAR_CHANNEL_ID = process.env.DAFTAR_CHANNEL_ID || null;

// Catatan: field `flags` di /applications/@me tidak bisa diandalkan untuk intent ini
// (pernah dilaporkan "limited" padahal sudah aktif dan gateway menerima). Jadi selama
// DAFTAR_CHANNEL_ID diisi, kita minta intent-nya; kalau Discord menolak, error-nya jelas.
const intents = [GatewayIntentBits.Guilds];
if (DAFTAR_CHANNEL_ID) {
  intents.push(GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent);
  console.log(`[daftar] auto-daftar aktif di channel ${DAFTAR_CHANNEL_ID}`);
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
    const { data } = await api("/api/members", { method: "POST", body });
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
    const { data } = await api(`/api/members/${id}`, { method: "PATCH", body });
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
    const { data } = await api(`/api/members/${id}`, { method: "PATCH", body: { positionId } });
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
    const { data } = await api(`/api/members/${id}/${sub === "naik" ? "promote" : "demote"}`, { method: "POST" });
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
      if (!isAdd && !isDelete) return;
      if (!isAllowed(interaction)) {
        return interaction.reply({
          content: "⛔ Kamu tidak punya izin.",
          flags: MessageFlags.Ephemeral,
        });
      }
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

    if (!interaction.isChatInputCommand()) return;

    if (!isAllowed(interaction)) {
      return interaction.reply({
        content: "⛔ Kamu tidak punya izin memakai command ini.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const sub = interaction.commandName === "anggota" ? interaction.options.getSubcommand() : null;
    // cari & hapus bersifat privat (ephemeral); command lain tampil di channel.
    const isPrivate = sub === "cari" || sub === "hapus";
    await interaction.deferReply(isPrivate ? { flags: MessageFlags.Ephemeral } : {});

    let result;
    if (interaction.commandName === "struktur") {
      await refreshStruktur(client, { force: true });
      return await interaction.editReply(`✅ Struktur diperbarui: ${structureLink()}`);
    }
    result = await handleAnggota(interaction);

    if (result?.reply) {
      await interaction.editReply(result.reply);
      refreshStruktur(client);
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
  setInterval(() => refreshStruktur(c), REFRESH_MS);
});

// Auto-daftar dari channel: pesan berformat NAMA LENGKAP / JABATAN / STEAM HEX / ID DISCORD
// langsung disimpan ke database, lalu pesannya diberi reaksi ✅ (atau ⚠️ kalau ada yang dilewati).
client.on(Events.MessageCreate, async (message) => {
  if (!DAFTAR_CHANNEL_ID) return;
  if (message.channelId !== DAFTAR_CHANNEL_ID) return;
  try {
    await handleRegistrationMessage(message, {
      isAllowedMember,
      refreshStruktur: () => refreshStruktur(client),
    });
  } catch (err) {
    console.error("[daftar] error:", err.message ?? err);
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
