import { createHash } from "node:crypto";
import { EmbedBuilder } from "discord.js";
import { api } from "./api.js";
import { STATUS, escapeMd } from "./format.js";

const MARKER = "CT-STRUKTUR";
const MAX_EMBED_DESC = 3800;
const MAX_MESSAGE_CHARS = 5500;
const MAX_EMBEDS_PER_MESSAGE = 10;

function memberLine(m) {
  return `${STATUS[m.status].emoji} **${escapeMd(m.name)}**${m.hex ? ` — \`${m.hex}\`` : ""}`;
}

function chunkLines(lines, max) {
  const chunks = [];
  let current = [];
  let size = 0;
  for (const line of lines) {
    if (current.length && size + line.length + 1 > max) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(line);
    size += line.length + 1;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

/** Ubah data grouped dari API menjadi daftar "pesan", masing-masing berisi beberapa embed. */
function buildMessages(groups) {
  const total = groups.reduce((n, g) => n + g.members.length, 0);
  const embeds = [
    {
      title: "STRUKTUR CENTRAL-T",
      description: `Total **${total}** anggota\n🟢 Aktif  ⚫ Tidak Aktif  🔴 Diturunkan  ⚪ Tidak Diketahui`,
    },
  ];
  for (const g of groups) {
    const lines = g.members.length ? g.members.map(memberLine) : ["_Kosong_"];
    chunkLines(lines, MAX_EMBED_DESC).forEach((chunk, i) => {
      embeds.push({
        title: `${g.name} (${g.members.length})${i > 0 ? " — lanjutan" : ""}`,
        description: chunk.join("\n"),
      });
    });
  }

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
    new EmbedBuilder().setColor(0xffffff).setTitle(e.title).setDescription(e.description),
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
  const messages = buildMessages(groups);
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
