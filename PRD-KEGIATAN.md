# PRD - Kegiatan Central T

Status: **Fase 1 (web) + bot auto-catat terpasang & channel siap** · Tanggal: 14 November 2026
Fokus: halaman `/kegiatan` di web + auto-catat dari channel Discord.

---

## 1. Ringkasan

Kegiatan mencatat **agenda/acara yang diikuti anggota** (penyandaraan, patroli, negosiasi,
dsb.) memakai format baku yang sekarang ditulis manual:

```
NAMA ANGGOTA YANG IKUT KEGIATAN

TANGGAL KEGIATAN: 13/11/2026
KEGIATAN        : PENYANDRAAN JAPAPRIDE
NEGOSIASI       : MENANG 1JT UMER
NAMA ANGGOTA    :
 1. RENZO
 2. ROCKY
 3. SMITH
...
13. IPAN
```

Format tetap sama, tetapi diisi lewat web, tersimpan di database, bisa dicari,
dan bisa disalin ulang kapan saja.

---

## 2. Pemahaman format

| Field | Arti | Aturan |
|---|---|---|
| TANGGAL KEGIATAN | Tanggal kegiatan | `DD/MM/YYYY`, default hari ini (WIB) |
| KEGIATAN | Nama/jenis kegiatan | Wajib, 3–120 karakter, ada saran dari kegiatan sebelumnya |
| NEGOSIASI | Hasil negosiasi | **Opsional**, maks 200 karakter, tampil `—` jika kosong |
| NAMA ANGGOTA | Daftar peserta | Minimal 1, maks 50, bernomor urut `1.` `2.` dst. |

Catatan tampilan: nomor peserta rata kanan 2 digit (` 1.`, `10.`) seperti contoh,
supaya nama tetap sejajar.

---

## 3. Keputusan

| # | Keputusan |
|---|---|
| K1 | Peserta dipilih dari anggota terdaftar **atau** nama manual (orang di luar database) |
| K2 | NEGOSIASI opsional |
| K3 | Tanpa status kegiatan (cukup tercatat, seperti WD) |
| K4 | Tanggal saja, tanpa jam |
| K5 | Belum dihubungkan ke WD/barang |
| K6 | Nama peserta disimpan sebagai snapshot + `memberId` (jika dari anggota) agar rekap lama tetap valid walau anggota di-rename |
| K7 | Kode kegiatan `KGT-YYYYMMDD-NNN` (konsisten dengan WD) |
| K8 | Bot Discord ditunda ke fase berikutnya |

---

## 4. Alur bisnis

### 4.1 Catat kegiatan
1. Klik **+ Catat kegiatan** di `/kegiatan`.
2. Isi tanggal (default hari ini), nama kegiatan, negosiasi (boleh kosong).
3. Tambah peserta:
   - ketik nama → pilih dari daftar anggota (bisa dicari), atau
   - ketik nama baru → **Tambah "<nama>"** untuk peserta non-anggota.
4. Simpan → sistem membuat kode `KGT-YYYYMMDD-NNN`.

### 4.2 Ubah / hapus
- Ikon ✎ membuka form yang sama (peserta bisa ditambah/dihapus/diurutkan ulang).
- Ikon 🗑 menghapus kegiatan beserta daftar pesertanya (dengan konfirmasi).

### 4.3 Detail & salin
- Ikon ⧉ membuka detail berisi teks format baku + tombol **Salin format**
  (untuk ditempel ke Discord atau diarsipkan).

### 4.4 Rekap
- Kartu statistik: **Kegiatan bulan ini · Peserta bulan ini · Total kegiatan**.
- Pencarian & filter tanggal untuk melihat riwayat.

---

## 5. Model data (usulan)

```prisma
model Activity {
  id            Int                   @id @default(autoincrement())
  code          String                @unique                 // KGT-YYYYMMDD-NNN
  title         String                                        // KEGIATAN
  negotiation   String?                                       // NEGOSIASI
  activityDate  DateTime              @map("activity_date")
  createdBy     String?               @map("created_by")
  participants  ActivityParticipant[]
  createdAt     DateTime              @default(now()) @map("created_at")
  updatedAt     DateTime              @updatedAt      @map("updated_at")

  @@index([activityDate])
  @@map("activities")
}

model ActivityParticipant {
  id         Int      @id @default(autoincrement())
  activityId Int      @map("activity_id")
  activity   Activity @relation(fields: [activityId], references: [id], onDelete: Cascade)
  memberId   Int?     @map("member_id")
  member     Member?  @relation(fields: [memberId], references: [id], onDelete: SetNull)
  name       String                                        // snapshot nama
  sortOrder  Int      @default(0) @map("sort_order")
  createdAt  DateTime @default(now()) @map("created_at")

  @@unique([activityId, memberId])
  @@index([activityId])
  @@index([memberId])
  @@map("activity_participants")
}
```

`Member` mendapat relasi balik `activityParticipations ActivityParticipant[]`.

Migrasi terpasang: `prisma/migrations/20261113075544_add_activities`.

---

## 6. API (usulan)

| Method & path | Fungsi |
|---|---|
| `GET /api/activities` | List + filter `search`, `from`, `to`, `memberId`, `page`, `pageSize` |
| `POST /api/activities` | Catat kegiatan + peserta |
| `GET /api/activities/[id]` | Detail + peserta |
| `PATCH /api/activities/[id]` | Ubah kegiatan/peserta |
| `DELETE /api/activities/[id]` | Hapus |
| `GET /api/activities/stats` | Kegiatan bulan ini, peserta bulan ini, total |
| `GET /api/activities/suggestions` | Saran nama kegiatan dari data sebelumnya |

---

## 7. Halaman web `/kegiatan`

- Ringkasan: **Kegiatan bulan ini · Peserta bulan ini · Total kegiatan**.
- Filter: pencarian (kegiatan/negosiasi/nama peserta), rentang tanggal kegiatan.
- Tabel: Tanggal · Kegiatan · Negosiasi · Peserta (jumlah + beberapa nama) · Aksi.
- Form: tanggal, kegiatan (+ saran), negosiasi (opsional), peserta.
- Pemilih peserta: cari anggota, tambah nama manual, daftar bernomor, hapus, jaga urutan.
- Detail: teks format baku + **Salin format**.
- Pagination 20/halaman, tema gelap sama seperti WD.

Status: sudah terpasang di `/kegiatan` (bukan lagi placeholder).

---

## 8. Validasi

- Tanggal wajib & valid (default hari ini WIB).
- Kegiatan 3–120 karakter.
- Negosiasi ≤ 200 karakter (opsional).
- Peserta 1–50; nama manual 2–60 karakter.
- Tidak boleh ada peserta ganda (anggota sama atau nama sama, case-insensitive).
- Nama anggota disimpan sebagai snapshot `nama` (bukan `CT - nama`).
- Peserta dari anggota menyimpan `memberId` untuk rekap keaktifan.

---

## 9. Bot Discord (terpasang, channel siap)

Skema mengikuti auto-daftar struktur: tulis pesan berformat baku di channel, bot mencatat, lalu
pesannya diberi reaksi ✅.

- Channel: `👥┃𝙽𝙰𝙼𝙰-𝙰𝙽𝙶𝙶𝙾𝚃𝙰-𝚈𝙰𝙽𝙶-𝙸𝙺𝚄𝚃-𝙺𝙴𝙶𝙸𝙰𝚃𝙰𝙽` =
  `1568673636355670218` (`KEGIATAN_CHANNEL_ID`).
- Pesan valid → `POST /api/activities`, kode `KGT-YYYYMMDD-NNN`, reaksi ✅.
- Format salah → reaksi ⚠️ + alasan + contoh format (pesan balasan hilang sendiri 25 detik).
- Pengirim di luar allowlist → ⛔. Chat biasa di channel diabaikan.
- **Edit pesan = edit data yang sama**, lewat `activities.discord_message_id` (unique) —
  tidak membuat baris baru.
- Peserta dicocokkan ke anggota (nama persis, case-insensitive); nama yang tidak ada disimpan
  sebagai peserta manual (K1).
- `/kegiatan rekap` → kegiatan bulan ini, peserta bulan ini, total, + 10 kegiatan terakhir.
- Batas: 1–50 peserta, nama manual 2–60 karakter, tanggal `DD/MM/YYYY` atau `YYYY-MM-DD`.
- Migrasi: `prisma/migrations/20261114130000_add_activity_discord_message`.

✅ **Akses channel diberikan (14 Nov 2026):** `CT - BOT` sudah punya **View Channel,
Read Message History, Add Reactions, Send Messages, Embed Links**. Tinggal uji kirim format
asli di channel.

## 10. Fase berikutnya

1. **Bot Discord (lanjutan)**: uji end-to-end setelah izin channel, `/kegiatan catat`,
   `/kegiatan impor` untuk pesan lama, kartu embed + tombol (opsional).
2. **Rekap & statistik lanjutan**: kegiatan per anggota, grafik bulanan, export CSV.
3. **Kehadiran**: status hadir/izin, foto bukti kegiatan.
4. **Integrasi WD**: barang yang dipakai pada kegiatan.

---

## 11. Di luar lingkup saat ini

- Kehadiran detail, foto, dan lampiran.
- Sinkronisasi dengan Berangkas/WD.
- Login/role web.
