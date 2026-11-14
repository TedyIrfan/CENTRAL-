# PRD - WD (Withdraw & Pengembalian Barang) Central T

Status: **Fase 1 (web) diimplementasikan** · Tanggal: 13 November 2026
Fokus saat ini: halaman `/wd` di web. **Bot Discord & seed/master barang = fase berikutnya.**

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
| DURAB DIKEMBALIKAN | Durabilitas saat dikembalikan | Diisi saat kembali, tidak boleh > durab awal |
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
| D6 | Bot Discord **ditunda** ke fase berikutnya |
| D7 | Barang hilang wajib ditandai **beserta alasan** |
| D8 | Kode transaksi `WD-YYYYMMDD-NNN` |

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
  (untuk ditempel manual ke Discord selama bot belum aktif).

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
  discordMessageId String?   @map("discord_message_id") // disiapkan untuk bot
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
| `GET /api/wd` | List + filter `status`, `search`, `item`, `from`, `to`, `page`, `pageSize` |
| `POST /api/wd` | Buat WD (ambil) |
| `GET /api/wd/[id]` | Detail |
| `PATCH /api/wd/[id]` | Edit (hanya status DIPINJAM) |
| `POST /api/wd/[id]/return` | Kembalikan |
| `POST /api/wd/[id]/lost` | Tandai hilang (alasan wajib) |
| `DELETE /api/wd/[id]` | Hapus |
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

## 9. Validasi

- Anggota wajib dipilih; nama disimpan `CT - <Nama>`.
- Jenis barang wajib (2–100 karakter).
- Senjata: SN wajib, durab awal wajib.
- SN yang masih `DIPINJAM` tidak bisa dipakai transaksi baru (409).
- Durab bulat 0–100; durab kembali ≤ durab awal.
- Qty bulat 1–10.000.
- Tanggal kembali ≥ tanggal ambil.
- Keperluan 3–500 karakter; alasan hilang 3–500 karakter.
- Edit hanya untuk transaksi `DIPINJAM`; kembali/hilang hanya sekali.
- Zona waktu `Asia/Jakarta`.

---

## 10. Fase berikutnya

1. **Bot Discord** (belum dikerjakan): `/wd ambil`, `/wd kembali`, `/wd cari`, `/wd daftar`;
   embed format baku di channel WD, update embed saat kembali, log channel,
   pengingat harian.
2. **Master barang & Berangkas**: seed daftar senjata/barang, CRUD barang,
   relasi `itemId`, opsi stok.
3. **Lanjutan**: jatuh tempo + TERLAMBAT, export CSV, statistik, approval.

---

## 11. Di luar lingkup saat ini

- Sinkronisasi stok Berangkas.
- Bot Discord.
- Jatuh tempo/denda.
- Login/role web.
- Export CSV dan riwayat perubahan.
