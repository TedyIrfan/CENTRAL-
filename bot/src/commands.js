import { ApplicationCommandType, ContextMenuCommandBuilder, SlashCommandBuilder } from "discord.js";
import { STATUS_CHOICES } from "./format.js";

const namaOption = (o, desc = "Nama anggota (ketik untuk mencari)") =>
  o.setName("nama").setDescription(desc).setAutocomplete(true).setRequired(true);

export const CONTEXT_ADD_NAME = "Tambah ke Central T";

export const commands = [
  new ContextMenuCommandBuilder()
    .setName(CONTEXT_ADD_NAME)
    .setType(ApplicationCommandType.Message)
    .toJSON(),

  new SlashCommandBuilder()
    .setName("struktur")
    .setDescription("Perbarui dan tampilkan struktur Central T")
    .toJSON(),

  new SlashCommandBuilder()
    .setName("anggota")
    .setDescription("Kelola anggota Central T")
    .addSubcommand((s) =>
      s
        .setName("cari")
        .setDescription("Cari anggota berdasarkan nama atau steam hex")
        .addStringOption((o) => namaOption(o, "Nama atau steam hex")),
    )
    .addSubcommand((s) =>
      s
        .setName("tambah")
        .setDescription("Tambah anggota baru")
        .addStringOption((o) => o.setName("nama").setDescription("Nama anggota").setRequired(true))
        .addStringOption((o) =>
          o.setName("jabatan").setDescription("Jabatan").setAutocomplete(true).setRequired(true),
        )
        .addStringOption((o) => o.setName("hex").setDescription("Steam Hex, contoh steam:110000112345678"))
        .addStringOption((o) =>
          o.setName("status").setDescription("Status (default: Tidak Diketahui)").addChoices(...STATUS_CHOICES),
        ),
    )
    .addSubcommand((s) =>
      s.setName("naik").setDescription("Naikkan jabatan satu tingkat").addStringOption((o) => namaOption(o)),
    )
    .addSubcommand((s) =>
      s.setName("turun").setDescription("Turunkan jabatan satu tingkat").addStringOption((o) => namaOption(o)),
    )
    .addSubcommand((s) =>
      s
        .setName("status")
        .setDescription("Ubah status anggota (Diturunkan = jabatan otomatis turun)")
        .addStringOption((o) => namaOption(o))
        .addStringOption((o) =>
          o.setName("status").setDescription("Status baru").setRequired(true).addChoices(...STATUS_CHOICES),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("hex")
        .setDescription("Ubah Steam Hex anggota")
        .addStringOption((o) => namaOption(o))
        .addStringOption((o) =>
          o.setName("hex").setDescription("Steam Hex baru (kosongkan dengan tanda -)").setRequired(true),
        ),
    )
    .toJSON(),
];
