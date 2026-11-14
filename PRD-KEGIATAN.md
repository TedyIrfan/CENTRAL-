# PRD - Kegiatan Central T

Status: **Fase 1 (web) diimplementasikan** · Tanggal: 13 November 2026
Fokus: halaman `/kegiatan` di web. Bot Discord menyusul seperti WD.

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
  (untuk ditempel ke Discord selama bot belum aktif).

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

## 9. Fase berikutnya

1. **Bot Discord**: `/kegiatan catat`, `/kegiatan rekap`, embed format baku, log channel.
2. **Rekap & statistik lanjutan**: kegiatan per anggota, grafik bulanan, export CSV.
3. **Kehadiran**: status hadir/izin, foto bukti kegiatan.
4. **Integrasi WD**: barang yang dipakai pada kegiatan.

---

## 10. Di luar lingkup saat ini

- Kehadiran detail, foto, dan lampiran.
- Sinkronisasi dengan Berangkas/WD.
- Bot Discord.
- Login/role web.
