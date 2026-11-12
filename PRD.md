# PRD - Central T

## 1. Ringkasan
**Central T** adalah web internal khusus admin untuk mengelola data anggota: nama, jabatan, Steam, Hex, dan status.
Tanpa login (diasumsikan hanya diakses admin lewat jaringan lokal/privat).

## 2. Tujuan
- Satu tempat terpusat untuk data anggota.
- Pencarian dan pengelolaan data yang cepat.
- Jabatan fleksibel (bisa ditambah, diubah, dihapus dari web).

## 3. Non-Goals (fase ini)
- Login/role/autentikasi.
- Konversi otomatis SteamID64 ke Hex.
- Integrasi Steam API / server game.
- Export CSV, riwayat perubahan (masuk fase berikutnya).

## 4. Tech Stack
| Bagian | Pilihan |
|---|---|
| Framework | Next.js (full-stack, App Router, TypeScript) |
| Database | PostgreSQL |
| ORM | Prisma (atau Drizzle) |
| Infrastruktur | Docker Compose (service `app` + `db`, opsional `adminer`) |
| UI | Tailwind CSS |

## 5. Model Data

### `positions` (jabatan)
| Field | Tipe | Catatan |
|---|---|---|
| id | serial PK | |
| name | text, unique | nama jabatan |
| created_at | timestamp | |

### `members`
| Field | Tipe | Catatan |
|---|---|---|
| id | serial PK | |
| name | text, required | nama anggota |
| position_id | FK -> positions | nullable; `ON DELETE SET NULL` |
| steam | text | nama Steam / SteamID64 / link profil |
| hex | text, unique | format `steam:110000xxxxxxxxx` |
| status | enum | `AKTIF`, `TIDAK_AKTIF`, `DITURUNKAN`, `TIDAK_DIKETAHUI` |
| created_at / updated_at | timestamp | |

Default status: `TIDAK_DIKETAHUI`.

## 6. Fitur

### 6.1 Anggota
- Tabel daftar anggota (nama, jabatan, steam, hex, status).
- Tambah, edit, hapus anggota (dengan konfirmasi hapus).
- Pencarian (nama, steam, hex).
- Filter berdasarkan jabatan dan status.
- Badge warna per status.
- Pagination.
- Validasi: nama wajib, hex unik dan sesuai format, pesan error jelas.

### 6.2 Jabatan
- Halaman kelola jabatan: tambah, ubah nama, hapus.
- Nama jabatan unik.
- Jika jabatan dihapus, anggota terkait menjadi "tanpa jabatan" (peringatan ditampilkan berapa anggota terdampak).

### 6.3 Status
- Tetap (4 nilai), tidak bisa diubah dari web.

## 7. Halaman
| Route | Fungsi |
|---|---|
| `/` | Daftar anggota + filter + pencarian |
| `/members/new` | Form tambah anggota |
| `/members/[id]/edit` | Form edit anggota |
| `/positions` | Kelola jabatan |

## 8. Persyaratan Non-Fungsional
- Seluruh stack berjalan dengan `docker compose up`.
- Data DB persisten (volume Docker).
- Konfigurasi lewat `.env`.
- UI responsif (desktop utama).
- Bahasa UI: Indonesia.

## 9. Risiko dan Catatan
- **Tanpa login = siapa pun yang bisa akses URL bisa mengubah data.** Jalankan hanya di localhost/jaringan privat/VPN, jangan diekspos ke internet publik. Rencana: tambah auth sederhana (password admin) di fase berikutnya.
- Hex disimpan apa adanya; validasi hanya format.

## 10. Tahapan
1. Setup Docker Compose, Next.js, PostgreSQL, Prisma + skema + migrasi.
2. CRUD jabatan.
3. CRUD anggota + validasi.
4. Pencarian, filter, pagination.
5. Polish UI dan uji coba.

## 11. Fase Berikutnya (opsional)
- Konversi SteamID64 ke Hex otomatis dan link profil Steam.
- Export CSV.
- Riwayat perubahan status.
- Autentikasi admin.
