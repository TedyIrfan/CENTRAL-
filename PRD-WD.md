# PRD - WD (Withdraw & Pengembalian Barang) Central T

Status: **Fase 1 (web) + bot Discord terpasang** · Diperbarui: 14 November 2026
Fokus saat ini: halaman `/wd` di web dan `/wd` di bot Discord.
**Blocker aktif:** bot belum diberi akses ke channel WD (privat), jadi kartu belum bisa dikirim.
**Master barang/Berangkas = fase berikutnya.**

---

## 1. Ringkasan

WD mencatat **pengambilan (withdraw)** dan **pengembalian** barang milik Central T
(senjata/gear) oleh anggota, memakai format baku yang sudah dipakai manual:

```
FORMAT PENGAMBILAN & PENGEMBALIAN BARANG
TGL PENGAMBILAN   : /11/2026
TGL PENGEMBALIAN  : /11/2026
NAMA              : CT -
JENIS BARANG      :
SN                :
DURAB AWAL        :    %
DURAB DIKEMBALIKAN:    %
QTY               :    PCS
KEPERLUAN         :
```

Format tetap sama, tetapi diisi lewat web, tersimpan di database, bisa dicari, dan
menunjukkan mana yang masih di luar.

---

## 2. Pemahaman format

| Field | Arti | Aturan |
|---|---|---|
| TGL PENGAMBILAN | Tanggal barang diambil | `DD/MM/YYYY`, default hari ini (WIB) |
| TGL PENGEMBALIAN | Tanggal barang benar-benar dikembalikan | `DD/MM/YYYY`, `—` selama belum kembali |
| NAMA | Nama peminjam | Pilih anggota → otomatis `CT - <Nama>` |
| JENIS BARANG | Nama barang | Teks bebas (disarankan dari transaksi sebelumnya). Master barang menyusul bersama Berangkas |
| SN | Serial number | Wajib untuk senjata; non-senjata tidak perlu |
| DURAB AWAL | Durabilitas saat diambil | Wajib untuk senjata, bulat `0–100 %` |
| DURAB DIKEMBALIKAN | Durabilitas saat dikembalikan | Diisi saat kembali; **boleh sama**, tidak boleh lebih besar dari durab awal |
| QTY | Jumlah | Bulat `≥ 1`, satuan `PCS` |
| KEPERLUAN | Alasan pemakaian | Wajib, 3–500 karakter |

---

## 3. Keputusan

| # | Keputusan |
|---|---|
| D1 | WD hanya mencatat transaksi. Stok Berangkas tidak diubah |
| D2 | NAMA dipilih dari data anggota (tersimpan `memberId` + snapshot `CT - Nama`) |
| D3 | TGL PENGEMBALIAN = tanggal realisasi. Belum ada jatuh tempo/status TERLAMBAT |
| D4 | Satu transaksi = satu barang (satu SN, satu durab, satu qty) |
| D5 | SN & DURAB wajib hanya untuk senjata |
| D6 | Bot Discord terpasang: `/wd ambil`, `/wd kembali`, `/wd hilang`, `/wd cari`, `/wd daftar` |
| D7 | Barang hilang wajib ditandai **beserta alasan** |
| D8 | Kode transaksi `WD-YYYYMMDD-NNN` |
| D9 | Pengembalian dikirim sebagai **pesan baru** dengan format lengkap; kartu pengambilan tetap disimpan, hanya tombolnya dicabut |
| D10 | Transaksi `DIKEMBALIKAN`/`HILANG` masih terkunci (belum bisa dikoreksi); koreksi lewat "batal-kembali" belum dibuat |

---

## 4. Alur bisnis

### 4.1 Pengambilan
1. Klik **Ambil barang** di `/wd`.
2. Pilih anggota, isi jenis barang, centang **Senjata** bila perlu (SN & durab jadi wajib).
3. Isi qty, tanggal ambil, keperluan → simpan.
4. Sistem membuat kode `WD-YYYYMMDD-NNN`, status **DIPINJAM**.

### 4.2 Pengembalian
1. Klik ikon ↩ pada baris transaksi.
2. Isi tanggal kembali, durab dikembalikan (senjata), catatan kondisi (opsional).
3. Status → **DIKEMBALIKAN**.

### 4.3 Hilang
1. Klik ikon ⚠ pada transaksi yang masih dipinjam.
2. **Alasan hilang wajib diisi** → status **HILANG**.

### 4.4 Detail & salin format
- Ikon ⧉ membuka detail berisi teks format baku + tombol **Salin format**
  (cadangan untuk ditempel manual, misalnya ke channel lain).

### 4.5 Bot Discord (terpasang)
1. `/wd ambil` — pilih anggota, ketik barang, tentukan senjata (default **Ya** → SN & durab wajib),
   qty, keperluan, tanggal (opsional). Data langsung masuk database lewat API web, lalu bot
   mengirim **kartu pengambilan** berisi format baku ke channel WD.
2. Kartu pengambilan punya tombol **✅ Kembalikan** dan **⚠️ Tandai hilang**:
   - ✅ membuka modal durab (default = durab awal, **boleh sama**) + catatan kondisi;
     tanggal kembali otomatis hari ini (WIB). Setelah disimpan, bot mengirim **pesan baru**
     berisi format lengkap yang sudah terisi (`TGL PENGEMBALIAN` + `DURAB DIKEMBALIKAN`),
     dengan status 🟢 **Dikembalikan** dan tanpa tombol.
   - Pesan pengambilan lama **tetap ada** (isinya tidak diubah), hanya tombolnya dicabut
     agar tidak diklik dua kali.
   - ⚠️ membuka modal alasan hilang (wajib); hasilnya juga pesan baru dengan status 🔴 **Hilang**.
3. `/wd kembali` — kembalikan lewat perintah tanpa klik kartu (durab default = durab awal,
   tanggal default hari ini WIB); tetap mengirim pesan pengembalian baru.
4. `/wd hilang` — tandai hilang beserta alasan.
5. `/wd cari` — cari kode/nama/barang/SN, detail memakai format baku.
6. `/wd daftar` — daftar semua yang masih dipinjam.
7. Perubahan dari web (kembali/hilang) dideteksi tiap 2 menit lewat `updatedAt`; kalau kartu
   pengambilan masih berstatus "Dipinjam", bot mengirim pesan pengembalian baru dengan format
   yang sama, sehingga web dan Discord menampilkan data yang sama.
8. Koreksi setelah terlanjur dikembalikan **belum tersedia** (lihat §12).

---

## 5. Status

| Status | Arti |
|---|---|
| `DIPINJAM` | Barang masih di luar |
| `DIKEMBALIKAN` | Sudah kembali |
| `HILANG` | Tidak dikembalikan (alasan tersimpan) |

---

## 6. Model data (terpasang)

```prisma
enum WdStatus { DIPINJAM DIKEMBALIKAN HILANG }

model WdRecord {
  id               Int       @id @default(autoincrement())
  code             String    @unique
  memberId         Int?      @map("member_id")
  member           Member?   @relation(fields: [memberId], references: [id], onDelete: SetNull)
  borrowerName     String    @map("borrower_name")   // snapshot "CT - Nama"
  itemName         String    @map("item_name")
  isWeapon         Boolean   @default(false) @map("is_weapon")
  serialNumber     String?   @map("serial_number")
  qty              Int       @default(1)
  durabilityStart  Int?      @map("durability_start")
  durabilityReturn Int?      @map("durability_return")
  takenAt          DateTime  @map("taken_at")
  returnedAt       DateTime? @map("returned_at")
  purpose          String
  returnNote       String?   @map("return_note")
  lostReason       String?   @map("lost_reason")
  status           WdStatus  @default(DIPINJAM)
  discordMessageId String?   @map("discord_message_id") // ID pesan kartu terakhir (ambil / kembali)
  createdBy        String?   @map("created_by")
  returnedBy       String?   @map("returned_by")
  createdAt        DateTime  @default(now()) @map("created_at")
  updatedAt        DateTime  @updatedAt      @map("updated_at")

  @@index([status])
  @@index([borrowerName])
  @@index([serialNumber])
  @@index([takenAt])
  @@map("wd_records")
}
```

Migrasi: `prisma/migrations/20261113073201_add_wd_records`.

---

## 7. API (terpasang)

| Method & path | Fungsi |
|---|---|
| `GET /api/wd` | List + filter `status`, `search`, `item`, `from`, `to`, `updatedAfter` (ISO), `page`, `pageSize` |
| `POST /api/wd` | Buat WD (ambil) |
| `GET /api/wd/[id]` | Detail |
| `PATCH /api/wd/[id]` | Edit (hanya status DIPINJAM) |
| `POST /api/wd/[id]/return` | Kembalikan |
| `POST /api/wd/[id]/lost` | Tandai hilang (alasan wajib) |
| `DELETE /api/wd/[id]` | Hapus |
| `POST /api/wd/[id]/discord-message` | Simpan ID pesan kartu Discord (`discord_message_id`) |
| `GET /api/wd/stats` | Dipinjam, kembali bulan ini, hilang, total |
| `GET /api/wd/items` | Saran nama barang dari transaksi sebelumnya |

---

## 8. Halaman web `/wd` (terpasang)

- Ringkasan: **Masih dipinjam · Kembali bulan ini · Hilang**.
- Filter: pencarian (kode/nama/barang/SN), status, rentang tanggal ambil.
- Tabel: Kode · Peminjam · Barang (+SN) · Qty · Durab (awal → kembali) ·
  Tgl Ambil · Tgl Kembali · Status · Aksi.
- Form Ambil/Edit: anggota (bisa dicari dengan ketik nama/jabatan), jenis barang, toggle senjata, SN, durab, qty, tanggal, keperluan.
- Modal Kembali: tanggal, durab kembali, catatan kondisi.
- Modal Hilang: alasan (wajib).
- Detail: teks format baku + salin.
- Pagination 20/halaman.

---

### 8.1 Discord (terpasang)
- Satu transaksi = **dua pesan** di channel `WD_CHANNEL_ID`:
  1. **Kartu pengambilan** — format baku, `TGL PENGEMBALIAN`/`DURAB DIKEMBALIKAN` masih `—`,
     footer 🟡 *Dipinjam*, tombol ✅/⚠️.
  2. **Kartu pengembalian/hilang** — dikirim saat status berubah, format baku yang sama tetapi
     tanggal & durab kembali sudah terisi, footer 🟢 *Dikembalikan* / 🔴 *Hilang*, tanpa tombol.
- Kartu pengambilan tidak diubah isinya; hanya tombolnya dicabut setelah dipakai.
- `discord_message_id` menyimpan ID pesan kartu terakhir, dipakai sinkronisasi & koreksi.
- Command: `/wd ambil`, `/wd kembali`, `/wd hilang`, `/wd cari`, `/wd daftar`
  (autocomplete anggota, nama barang, dan kode transaksi).
- Balasan command bersifat ephemeral; kartunya publik di channel WD.
- Bot tidak menyentuh database langsung — semua lewat API web.
- **Syarat:** bot (`CT - BOT`) harus punya izin View Channel, Send Messages, Embed Links,
  Read Message History di channel WD. Channel WD saat ini privat, jadi kartu belum terkirim.

---

## 9. Validasi

- Anggota wajib dipilih; nama disimpan `CT - <Nama>`.
- Jenis barang wajib (2–100 karakter).
- Senjata: SN wajib, durab awal wajib.
- SN yang masih `DIPINJAM` tidak bisa dipakai transaksi baru (409).
- Durab bulat 0–100; durab kembali ≤ durab awal (**boleh sama**).
- Qty bulat 1–10.000.
- Tanggal kembali ≥ tanggal ambil.
- Keperluan 3–500 karakter; alasan hilang 3–500 karakter.
- Edit hanya untuk transaksi `DIPINJAM`; kembali/hilang hanya sekali.
- Zona waktu `Asia/Jakarta`.

---

## 10. Fase berikutnya

Prioritas dari atas:

1. **Koreksi transaksi** — `/wd batal-kembali` (balik ke `DIPINJAM`, hapus kartu pengembalian,
   pulihkan tombol) + tombol "Batalkan pengembalian" di web. Belum dibuat, diputuskan menyusul.
2. **Aktifkan kartu Discord** — beri bot akses ke channel WD (lihat §12).
3. **Master barang & Berangkas**: seed daftar senjata/barang, CRUD barang, relasi `itemId`, opsi stok.
4. **Lanjutan**: jatuh tempo + TERLAMBAT, export CSV, statistik, approval, pengingat harian.

---

## 11. Di luar lingkup saat ini

- Sinkronisasi stok Berangkas.
- Jatuh tempo/denda.
- Login/role web.
- Export CSV dan riwayat perubahan.

---

## 12. Status implementasi & yang belum selesai (14 Nov 2026)

**Selesai & terpasang**
- Web `/wd`: CRUD, filter, statistik, modal kembali/hilang, salin format.
- Bot `/wd`: `ambil`, `kembali`, `hilang`, `cari`, `daftar` (4 command terdaftar di Discord,
  termasuk context menu anggota).
- Kartu pengambilan (format baku + tombol ✅/⚠️) dan kartu pengembalian/hilang (pesan baru,
  format lengkap, tanpa tombol).
- API: `GET /api/wd?updatedAfter=`, `POST /api/wd/[id]/discord-message`.
- Sinkronisasi web → Discord tiap 2 menit (hanya untuk transaksi yang punya kartu).
- Durab kembali boleh sama dengan durab awal; modal web & Discord otomatis mengisi durab awal.

**Belum selesai / kurang**
1. **Bot belum punya akses channel WD** — `403 Missing Access`; channel privat & bot tidak ada
   di permission overwrite. Akibatnya kartu belum pernah terkirim dan alur ✅ belum diuji
   end-to-end dari Discord. Perlu tambah `CT - BOT` (View/Send/Embed/Read History).
2. **Koreksi belum ada** — transaksi `DIKEMBALIKAN`/`HILANG` terkunci; salah klik hanya bisa
   diatasi dengan hapus transaksi (riwayat & kode hilang).
3. **WD dari web tidak membuat kartu Discord** — hanya `/wd ambil` yang memposting kartu.
4. **`/wd daftar`** hanya menampilkan 20 transaksi, belum ada pagination.
5. **Log audit** — `LOG_CHANNEL_ID` masih kosong; perubahan WD tidak tercatat pelakunya.
6. **Master barang/Berangkas** belum ada; nama barang masih teks bebas + saran.
7. **Belum ada tes otomatis** untuk alur kartu/klik tombol (baru smoke test API).
