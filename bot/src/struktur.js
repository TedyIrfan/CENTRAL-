import { createHash } from "node:crypto";
import { EmbedBuilder } from "discord.js";
import { api } from "./api.js";
import { buildMessages } from "./struktur-format.js";

const MARKER = "CT-STRUKTUR";
const MAX_MESSAGE_CHARS = 5500;
const MAX_EMBEDS_PER_MESSAGE = 10;

/** Bungkus embed jadi satu pesan, sebanyak yang muat (maks 10 embed / 5500 karakter). */
function groupIntoMessages(embeds) {
  const messages = [];
  let current = [];
  let size = 0;
  for (const e of embeds) {
    const len = e.title.length + e.description.length;
    if (current.length && (current.length >= MAX_EMBEDS_PER_MESSAGE || size + len > MAX_MESSAGE_CHARS)) {
      messages.push(current);
      current = [];
      size = 0;
    }
    current.push(e);
    size += len;
  }
  if (current.length) messages.push(current);
  return messages;
}

function toPayload(embedData, index, count) {
  const embeds = embedData.map((e) =>
    new EmbedBuilder().setColor(e.color).setTitle(e.title).setDescription(e.description),
  );
  embeds[embeds.length - 1]
    .setFooter({ text: `${MARKER} • ${index + 1}/${count}` })
    .setTimestamp();
  return { embeds };
}

let lastHash = null;
let queue = Promise.resolve();

/** Posting / edit pesan struktur di channel. Aman dipanggil berulang; hanya menulis jika ada perubahan. */
export function refreshStruktur(client, { force = false } = {}) {
  queue = queue
    .then(() => doRefresh(client, force))
    .catch((err) => console.error("[struktur] gagal memperbarui:", err.message ?? err));
  return queue;
}

async function doRefresh(client, force) {
  const { data: groups } = await api("/api/members/grouped");
  const messages = groupIntoMessages(buildMessages(groups));
  const hash = createHash("sha1").update(JSON.stringify(messages)).digest("hex");
  if (!force && hash === lastHash) return;

  const channel = await client.channels.fetch(process.env.STRUKTUR_CHANNEL_ID);
  const fetched = await channel.messages.fetch({ limit: 100 });
  const existing = [...fetched.values()]
    .filter(
      (m) =>
        m.author.id === client.user.id &&
        m.embeds.some((e) => e.footer?.text?.startsWith(MARKER)),
    )
    .sort((a, b) => a.createdTimestamp - b.createdTimestamp);

  for (let i = 0; i < messages.length; i++) {
    const payload = toPayload(messages[i], i, messages.length);
    if (existing[i]) await existing[i].edit(payload);
    else await channel.send(payload);
  }
  for (const extra of existing.slice(messages.length)) await extra.delete().catch(() => {});

  lastHash = hash;
  console.log(`[struktur] diperbarui (${messages.length} pesan)`);
}

export function structureLink() {
  const guild = process.env.DISCORD_GUILD_ID;
  const channel = process.env.STRUKTUR_CHANNEL_ID;
  return `https://discord.com/channels/${guild}/${channel}`;
}
