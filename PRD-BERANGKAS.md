# PRD - Berangkas Central T

Status: **Fase 1 sederhana (database + API + halaman) terpasang** · 14 November 2026
Fokus: pencatatan **stok barang per unit**. Belum diisi data, belum terhubung otomatis ke WD,
belum ada import massal.

---

## 1. Ringkasan

Berangkas adalah daftar stok barang/senjata milik Central T. **Satu baris = satu unit.**
Senjata disimpan dengan **SN unik**; barang non-senjata boleh tanpa SN. Status menunjukkan
kondisi unit, dan durab dicatat bila diketahui.

Tujuan fase ini: punya tempat mencatat stok yang bisa dicari, difilter, dan diedit — sebagai
dasar modul Berangkas berikutnya (integrasi WD, import, riwayat).

---

## 2. Keputusan

| # | Keputusan |
|---|---|
| B1 | Satu baris = satu unit (bukan agregat qty) |
| B2 | SN wajib untuk senjata; unik (case-insensitive) |
| B3 | Durab opsional `0–100` (data lama boleh kosong) |
| B4 | Status tetap: `SIAP`, `DIPINJAM`, `HILANG`, `RUSAK` |
| B5 | Status unit Berangkas **disinkronkan otomatis** dari WD lewat SN: ambil → `DIPINJAM`, kembali → `SIAP`, hilang → `HILANG` |
| B6 | Tidak ada qty / stok gabungan; barang tanpa SN dicatat per unit |

---

## 3. Model data

```prisma
enum VaultStatus { SIAP DIPINJAM HILANG RUSAK }

model VaultItem {
  id           Int         @id @default(autoincrement())
  name         String                       // jenis barang, mis. "DA"
  serialNumber String?     @unique @map("serial_number")
  isWeapon     Boolean     @default(true) @map("is_weapon")
  durability   Int?
  status       VaultStatus @default(SIAP)
  note         String?
  createdAt    DateTime    @default(now()) @map("created_at")
  updatedAt    DateTime    @updatedAt @map("updated_at")
}
```

Migrasi: `prisma/migrations/20261114161000_add_vault_items`.

---

## 4. API

| Method & path | Fungsi |
|---|---|
| `GET /api/berangkas` | List + filter `search`, `status`, `name`, `page`, `pageSize` |
| `POST /api/berangkas` | Tambah unit |
| `GET /api/berangkas/[id]` | Detail |
| `PATCH /api/berangkas/[id]` | Edit sebagian |
| `DELETE /api/berangkas/[id]` | Hapus |
| `GET /api/berangkas/stats` | Total, siap, dipinjam, hilang, rusak |
| `GET /api/berangkas/names` | Saran nama barang (distinct) |

---

## 5. Halaman `/berangkas`

- Ringkasan: **Total · Siap · Dipinjam · Hilang · Rusak**.
- Filter: pencarian (nama/SN/catatan) + status; pagination 20/halaman.
- Tabel: Barang (+jenis) · SN · Durab · Status · Catatan · Aksi.
- Form Tambah/Edit: nama barang (saran dari data lama), toggle senjata, SN, durab, status, catatan.
- Hapus dengan konfirmasi.
- Bahasa UI: Indonesia, tema gelap sama seperti WD/Kegiatan.

---

## 6. Validasi

- Nama barang wajib, 2–100 karakter.
- SN wajib bila `isWeapon`; maks. 100 karakter; unik (case-insensitive).
- Durab opsional, bulat 0–100.
- Status harus salah satu enum.
- Catatan opsional, maks. 500 karakter.
- Non-senjata: SN & durab disimpan `null`.

---

## 7. Belum / fase berikutnya

1. ~~Isi data 18 unit DA~~ — **sudah diisi 14 Nov 2026**: 18 unit DA (16 `DIPINJAM`, 1 `SIAP`, 1 `HILANG`), durab terisi 2 unit.
2. ~~Integrasi WD~~ — **sudah jalan (14 Nov 2026):** status unit mengikuti WD lewat SN (ambil → `DIPINJAM`, kembali → `SIAP`, hilang → `HILANG`, hapus WD → `SIAP`).
3. **Import massal** — tempel daftar SN (format stok) → banyak baris sekaligus.
4. **Riwayat perubahan** status/kondisi per unit.
5. **Qty untuk barang non-senjata** (amunisi/gear) bila diperlukan.
