import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } from "discord.js";
import { api, describeError, UserError } from "./api.js";
import { escapeMd } from "./format.js";

const PENDING_TTL_MS = 10 * 60_000;
const MAX_ENTRIES = 25;
const pending = new Map();

// ---------- parser format pendaftaran ----------

const FIELDS = {
  name: ["nama lengkap", "nama"],
  hex: ["steam hex", "hex steam", "steam", "hex"],
  discord: ["id discord", "discord id", "id dc", "discord"],
};

const isEmpty = (v) => v === "" || /^[-–—_.]+$/.test(v);
const blank = () => ({ name: null, hex: null, discord: null });

/**
 * Baca pesan berformat "NAMA LENGKAP : ..., STEAM HEX : ..., ID DISCORD : ...".
 * Satu pesan boleh berisi banyak blok; blok baru dimulai saat sebuah kolom muncul untuk kedua kali.
 */
export function parseRegistrations(text) {
  const blocks = [];
  let cur = blank();
  const used = () => cur.name !== null || cur.hex !== null || cur.discord !== null;

  const clean = text.replace(/[`*~|]/g, "");
  for (const line of clean.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z ]{2,20}?)\s*[:=]\s*(.*?)\s*$/.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase().replace(/\s+/g, " ").trim();
    const value = m[2].trim();

    const field = Object.keys(FIELDS).find((f) => FIELDS[f].includes(key));
    if (!field) continue;

    if (cur[field] !== null) {
      blocks.push(cur);
      cur = blank();
    }

    if (isEmpty(value)) cur[field] = "";
    else if (field === "name") cur.name = value.replace(/\s+/g, " ");
    else if (field === "hex") {
      const hex = /(?:steam:)?[0-9a-f]{8,17}/i.exec(value);
      cur.hex = hex ? hex[0].toLowerCase() : value;
    } else {
      const id = /\d{15,20}/.exec(value);
      cur.discord = id ? id[0] : value;
    }
  }
  if (used()) blocks.push(cur);
  return blocks;
}

// ---------- tampilan ----------

function itemLine(i, item) {
  if (item.error) return `${i + 1}. ❌ ${item.error}`;
  const parts = [`${i + 1}. **${escapeMd(item.name)}**`];
  parts.push(item.hex ? `\`${item.hex}\`` : "_tanpa hex_");
  if (item.discordId) parts.push(`<@${item.discordId}>`);
  if (item.notes.length) parts.push(item.notes.join(" "));
  return parts.join(" — ");
}

function previewEmbed(items) {
  const valid = items.filter((i) => !i.error);
  const embed = new EmbedBuilder().setColor(0xffffff);

  if (items.length === 1 && valid.length === 1) {
    const p = valid[0];
    embed
      .setTitle("Tambah anggota baru?")
      .addFields(
        { name: "Nama lengkap", value: escapeMd(p.name) },
        { name: "Steam Hex", value: p.hex ? `\`${p.hex}\`` : "—", inline: true },
        {
          name: "ID Discord",
          value: p.discordId ? `<@${p.discordId}>\n\`${p.discordId}\`` : "—",
          inline: true,
        },
      );
    if (p.notes.length) embed.setDescription(p.notes.join("\n"));
  } else {
    embed
      .setTitle(`Tambah ${valid.length} anggota sekaligus?`)
      .setDescription(items.map((it, i) => itemLine(i, it)).join("\n").slice(0, 4000));
  }
  return embed.setFooter({
    text:
      valid.length > 1
        ? `Jabatan yang dipilih berlaku untuk semua ${valid.length} anggota. Berlaku 10 menit.`
        : "Pilih jabatan untuk menyimpan. Berlaku 10 menit.",
  });
}

function positionButtons(key, positions) {
  const buttons = positions.map((pos) =>
    new ButtonBuilder()
      .setCustomId(`add|${key}|${pos.id}`)
      .setLabel(pos.name)
      .setStyle(ButtonStyle.Secondary),
  );
  buttons.push(new ButtonBuilder().setCustomId(`addx|${key}`).setLabel("Batal").setStyle(ButtonStyle.Danger));
  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
  }
  return rows;
}

function sweep() {
  const now = Date.now();
  for (const [k, v] of pending) if (v.expires < now) pending.delete(k);
}

/** Validasi satu blok hasil parser menjadi item siap simpan. */
function buildItem(block, index, { author, single }) {
  const notes = [];
  if (!block.name) {
    return { error: `Blok ke-${index + 1}: NAMA LENGKAP kosong, dilewati.` };
  }

  let discordId = null;
  if (block.discord && /^\d{15,20}$/.test(block.discord)) {
    discordId = block.discord;
    if (single && !author.bot && author.id !== discordId) {
      notes.push(`⚠️ ID Discord berbeda dengan pengirim pesan (<@${author.id}>).`);
    }
  } else if (single && !author.bot) {
    discordId = author.id;
    notes.push(
      block.discord
        ? `ℹ️ ID Discord tidak valid ("${escapeMd(block.discord)}"), memakai akun pengirim pesan.`
        : "ℹ️ ID Discord kosong, memakai akun pengirim pesan.",
    );
  } else if (block.discord) {
    notes.push("⚠️ ID Discord tidak valid.");
  }

  let hex = block.hex || null;
  if (hex) {
    let h = hex.toLowerCase();
    if (/^[0-9a-f]{8,17}$/.test(h)) h = `steam:${h}`;
    if (!/^steam:[0-9a-f]{8,17}$/.test(h)) {
      notes.push(`⚠️ Hex "${escapeMd(hex)}" tidak valid, tidak disimpan.`);
      hex = null;
    } else hex = h;
  } else {
    notes.push("⚠️ Hex kosong.");
  }

  return { name: block.name, hex, discordId, notes };
}

// ---------- handler ----------

/** Klik kanan pesan -> Apps -> "Tambah ke Central T". */
export async function handleContextAdd(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const message = interaction.targetMessage;
    const text = message.content ?? "";
    if (!text.trim()) {
      throw new UserError("Pesan ini tidak berisi teks yang bisa dibaca (mungkin hanya gambar atau embed).");
    }

    const blocks = parseRegistrations(text);
    if (blocks.length === 0 || blocks.every((b) => !b.name)) {
      throw new UserError(
        "Format tidak terbaca. Kolom **NAMA LENGKAP** wajib ada.\n" +
          "Contoh (boleh beberapa anggota dalam satu pesan):\n```\nNAMA LENGKAP : Budi Santoso\nSTEAM HEX    : steam:110000112345678\nID DISCORD   : 123456789012345678\n```",
      );
    }
    if (blocks.length > MAX_ENTRIES) {
      throw new UserError(`Terlalu banyak (${blocks.length}). Maksimal ${MAX_ENTRIES} anggota per pesan.`);
    }

    const single = blocks.length === 1;
    const items = blocks.map((b, i) => buildItem(b, i, { author: message.author, single }));

    // Nama ganda di dalam pesan yang sama.
    const seen = new Set();
    for (const it of items) {
      if (it.error) continue;
      const k = it.name.toLowerCase();
      if (seen.has(k)) Object.assign(it, { error: `${escapeMd(it.name)}: nama dobel di pesan ini, dilewati.` });
      seen.add(k);
    }

    const { data: positions } = await api("/api/positions");
    const key = interaction.id;
    sweep();
    pending.set(key, { adminId: interaction.user.id, items, expires: Date.now() + PENDING_TTL_MS });

    await interaction.editReply({
      embeds: [previewEmbed(items)],
      components: positionButtons(key, positions),
    });
  } catch (err) {
    await interaction
      .editReply({ content: `❌ ${err instanceof UserError ? err.message : describeError(err)}` })
      .catch(() => {});
  }
}

async function addOne(item, positionId) {
  const dupes = await api(`/api/members?search=${encodeURIComponent(item.name)}&pageSize=10`);
  const same = dupes.data.find((m) => m.name.toLowerCase() === item.name.toLowerCase());
  if (same) throw new UserError(`sudah ada (${same.position.name})`);

  const { data } = await api("/api/members", {
    method: "POST",
    body: {
      name: item.name,
      positionId,
      status: "AKTIF",
      ...(item.hex ? { hex: item.hex } : {}),
      ...(item.discordId ? { discordId: item.discordId } : {}),
    },
  });
  return data;
}

/** Tombol pilih jabatan / batal. */
export async function handleAddButton(interaction, deps) {
  const [action, key, positionIdRaw] = interaction.customId.split("|");
  const entry = pending.get(key);

  if (!entry) {
    return interaction.reply({
      content: "⌛ Pratinjau sudah kedaluwarsa. Klik kanan pesannya lagi.",
      flags: MessageFlags.Ephemeral,
    });
  }
  if (entry.adminId !== interaction.user.id) {
    return interaction.reply({ content: "Pratinjau ini milik admin lain.", flags: MessageFlags.Ephemeral });
  }
  if (action === "addx") {
    pending.delete(key);
    return interaction.update({ content: "Dibatalkan.", embeds: [], components: [] });
  }

  pending.delete(key); // cegah klik ganda
  await interaction.update({ content: "⏳ Menyimpan…", embeds: [], components: [] });

  const positionId = Number(positionIdRaw);
  const added = [];
  const failed = [];
  for (const [i, item] of entry.items.entries()) {
    if (item.error) {
      failed.push(item.error);
      continue;
    }
    try {
      added.push(await addOne(item, positionId));
    } catch (err) {
      failed.push(`${escapeMd(item.name)}: ${err instanceof UserError ? err.message : describeError(err)}`);
    }
  }

  if (added.length === 1 && failed.length === 0) {
    const m = added[0];
    await interaction.editReply({ content: "", embeds: [deps.memberEmbed(m, "✅ Anggota ditambahkan")] });
  } else {
    const embed = new EmbedBuilder()
      .setColor(added.length ? 0xffffff : 0xf43f5e)
      .setTitle(`${added.length} anggota ditambahkan${failed.length ? `, ${failed.length} gagal` : ""}`);
    if (added.length) {
      embed.addFields({
        name: `✅ Berhasil (${added[0].position.name})`,
        value: added.map((m) => `• ${escapeMd(m.name)}`).join("\n").slice(0, 1000),
      });
    }
    if (failed.length) {
      embed.addFields({ name: "❌ Gagal / dilewati", value: failed.map((f) => `• ${f}`).join("\n").slice(0, 1000) });
    }
    await interaction.editReply({ content: "", embeds: [embed] });
  }

  if (added.length) {
    const names = added.map((m) => `**${escapeMd(m.name)}**`).join(", ");
    await deps.sendLog(interaction, `➕ ${names} ditambahkan ke **${added[0].position.name}**`);
    deps.refreshStruktur();
  }
}
