import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } from "discord.js";
import { actorOf, api, describeError } from "./api.js";
import { escapeMd } from "./format.js";

const PENDING_TTL_MS = 2 * 60_000;
const pending = new Map();

function sweep() {
  const now = Date.now();
  for (const [k, v] of pending) if (v.expires < now) pending.delete(k);
}

/** Pratinjau konfirmasi sebelum anggota benar-benar dihapus. */
export function buildDeleteConfirm(interaction, member) {
  sweep();
  const key = interaction.id;
  pending.set(key, {
    memberId: member.id,
    name: member.name,
    userId: interaction.user.id,
    expires: Date.now() + PENDING_TTL_MS,
  });

  const embed = new EmbedBuilder()
    .setColor(0xffffff)
    .setTitle("Hapus anggota?")
    .setDescription(
      "Tindakan ini **permanen** dan tidak bisa dibatalkan.\n" +
        "Riwayat WD/kegiatan yang terkait tetap tersimpan, tapi tautannya ke anggota ini dilepas.",
    )
    .addFields(
      { name: "Nama", value: escapeMd(member.name), inline: true },
      { name: "Jabatan", value: escapeMd(member.position.name), inline: true },
      { name: "Status", value: member.status, inline: true },
      { name: "Steam Hex", value: member.hex ? `\`${member.hex}\`` : "—", inline: true },
    )
    .setFooter({ text: "Konfirmasi berlaku 2 menit." });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`del|${key}`).setLabel("Hapus permanen").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`delx|${key}`).setLabel("Batal").setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row] };
}

/** Tombol konfirmasi/batal pada pratinjau hapus. */
export async function handleDeleteButton(interaction, deps) {
  const [action, key] = interaction.customId.split("|");
  const entry = pending.get(key);

  if (!entry) {
    return interaction.reply({
      content: "⌛ Konfirmasi sudah kedaluwarsa. Jalankan `/anggota hapus` lagi.",
      flags: MessageFlags.Ephemeral,
    });
  }
  if (entry.userId !== interaction.user.id) {
    return interaction.reply({
      content: "Konfirmasi ini milik orang lain. Jalankan `/anggota hapus` sendiri.",
      flags: MessageFlags.Ephemeral,
    });
  }

  if (action === "delx") {
    pending.delete(key);
    return interaction.update({ content: "Dibatalkan.", embeds: [], components: [] });
  }

  pending.delete(key); // cegah klik ganda
  await interaction.update({ content: "⏳ Menghapus…", embeds: [], components: [] });

  try {
    const { data } = await api(`/api/members/${entry.memberId}`, {
      method: "DELETE",
      actor: actorOf(interaction.user, interaction.member?.displayName),
    });
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xffffff)
          .setTitle("✅ Anggota dihapus")
          .setDescription(`**${escapeMd(data.name)}** sudah dihapus permanen.`),
      ],
    });
    await deps.sendLog(interaction, `🗑️ **${escapeMd(data.name)}** dihapus permanen`);
    deps.refreshStruktur();
  } catch (err) {
    await interaction.editReply({ content: `❌ ${describeError(err)}` });
  }
}
