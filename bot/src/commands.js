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
    .addSubcommand((s) =>
      s
        .setName("hapus")
        .setDescription("Hapus anggota (perlu konfirmasi)")
        .addStringOption((o) => namaOption(o)),
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName("wd")
    .setDescription("Catat pengambilan & pengembalian barang (WD)")
    .addSubcommand((s) =>
      s
        .setName("ambil")
        .setDescription("Catat pengambilan barang (langsung masuk database & web)")
        .addStringOption((o) =>
          o
            .setName("anggota")
            .setDescription("Anggota peminjam (ketik untuk mencari)")
            .setAutocomplete(true)
            .setRequired(true),
        )
        .addStringOption((o) =>
          o
            .setName("barang")
            .setDescription("Jenis barang (ketik untuk saran dari transaksi sebelumnya)")
            .setAutocomplete(true)
            .setRequired(true),
        )
        .addStringOption((o) =>
          o
            .setName("keperluan")
            .setDescription("Keperluan pemakaian (3-500 karakter)")
            .setRequired(true)
            .setMaxLength(500),
        )
        .addStringOption((o) =>
          o
            .setName("senjata")
            .setDescription("Senjata? (default: Ya — wajib SN & durab)")
            .addChoices(
              { name: "Ya — senjata (wajib SN & durab)", value: "ya" },
              { name: "Tidak — barang biasa", value: "tidak" },
            ),
        )
        .addStringOption((o) =>
          o.setName("sn").setDescription("Serial number (wajib untuk senjata)").setMaxLength(100),
        )
        .addIntegerOption((o) =>
          o
            .setName("durab")
            .setDescription("Durab awal 0-100 (wajib untuk senjata)")
            .setMinValue(0)
            .setMaxValue(100),
        )
        .addIntegerOption((o) =>
          o.setName("qty").setDescription("Jumlah (default 1)").setMinValue(1).setMaxValue(10000),
        )
        .addStringOption((o) =>
          o
            .setName("tanggal")
            .setDescription("Tanggal ambil YYYY-MM-DD (default hari ini WIB)")
            .setMaxLength(10),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("kembali")
        .setDescription("Kembalikan barang yang masih dipinjam")
        .addStringOption((o) =>
          o
            .setName("kode")
            .setDescription("Kode transaksi WD (ketik untuk mencari)")
            .setAutocomplete(true)
            .setRequired(true),
        )
        .addIntegerOption((o) =>
          o
            .setName("durab")
            .setDescription("Durab dikembalikan 0-100 (default: sama dengan durab awal)")
            .setMinValue(0)
            .setMaxValue(100),
        )
        .addStringOption((o) =>
          o
            .setName("tanggal")
            .setDescription("Tanggal kembali YYYY-MM-DD (default hari ini WIB)")
            .setMaxLength(10),
        )
        .addStringOption((o) =>
          o.setName("catatan").setDescription("Catatan kondisi (opsional)").setMaxLength(500),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("hilang")
        .setDescription("Tandai barang tidak dikembalikan (hilang)")
        .addStringOption((o) =>
          o
            .setName("kode")
            .setDescription("Kode transaksi WD (ketik untuk mencari)")
            .setAutocomplete(true)
            .setRequired(true),
        )
        .addStringOption((o) =>
          o.setName("alasan").setDescription("Alasan hilang (wajib)").setRequired(true).setMaxLength(500),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("cari")
        .setDescription("Cari transaksi WD (kode/nama/barang/SN)")
        .addStringOption((o) => o.setName("kata").setDescription("Kata kunci").setRequired(true)),
    )
    .addSubcommand((s) =>
      s.setName("daftar").setDescription("Lihat semua barang yang masih dipinjam"),
    )
    .toJSON(),
];
