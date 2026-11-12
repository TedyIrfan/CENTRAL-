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

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

function isAllowed(interaction) {
  if (ALLOWED_USERS.includes(interaction.user.id)) return true;
  const perms = interaction.memberPermissions;
  if (perms?.has(PermissionFlagsBits.Administrator) || perms?.has(PermissionFlagsBits.ManageGuild)) return true;
  const roles = interaction.member?.roles?.cache;
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
      if (!/^addx?\|/.test(interaction.customId)) return;
      if (!isAllowed(interaction)) {
        return interaction.reply({
          content: "⛔ Kamu tidak punya izin.",
          flags: MessageFlags.Ephemeral,
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

    const isRead = interaction.commandName === "anggota" && interaction.options.getSubcommand() === "cari";
    await interaction.deferReply(isRead ? { flags: MessageFlags.Ephemeral } : {});

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
  try {
    const guild = await c.guilds.fetch(DISCORD_GUILD_ID);
    await guild.commands.set(commands);
    console.log(`[bot] ${commands.length} command terdaftar di server "${guild.name}"`);
  } catch (err) {
    console.error("[bot] gagal mendaftarkan command:", err.message);
  }
  refreshStruktur(c, { force: true });
  setInterval(() => refreshStruktur(c), REFRESH_MS);
});

client.on(Events.Error, (err) => console.error("[bot] error:", err.message));
process.on("unhandledRejection", (err) => console.error("[bot] unhandledRejection:", err));

client.login(DISCORD_TOKEN);
