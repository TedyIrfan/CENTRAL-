# PROGRESS — Central T

Catatan progres per modul. Terakhir diperbarui: **15 Nov 2026**.

Status modul **Struktur & Anggota** menurut pemilik proyek: **99% selesai** (belum ditutup).
Modul **WD (Withdraw)** selesai di web & bot; akses channel sudah diberikan dan **auto-catat
dari chat sudah diuji end-to-end** (`WD-20261112-001`). Yang belum: uji klik ✅ pada kartu
(detail di §3–§5).
Modul **Kegiatan** sudah jalan di web & bot; **akses channel kegiatan juga sudah diberikan
(14 Nov 2026)**, tinggal uji kirim format asli (detail di §4–§5).

> **15 Nov 2026 — redesain UI ("kertas & tinta") selesai di semua halaman web.**
> Rincian ada di §10.

---

## 1. Status antar modul

| Modul | Web | Bot Discord | Status |
|---|---|---|---|
| **Struktur & Anggota** | ✅ selesai | ✅ selesai | **99%** — tinggal penyelesaian kecil |
| **WD (Withdraw)** | ✅ selesai | ✅ terpasang, auto-catat chat sudah diuji | tinggal uji klik ✅ kartu |
| Kegiatan | ✅ selesai | ✅ terpasang, channel sudah bisa diakses | tinggal uji kirim format |
| Berangkas | ✅ sederhana (DB + API + web) | – | 18 unit DA terisi |

---

## 2. Struktur & Anggota — yang sudah jalan

**Web**
- CRUD anggota (tambah, ubah, hapus dengan konfirmasi), CRUD jabatan
- Papan struktur (`/`) dan tabel per jabatan (`/anggota`), pencarian, filter jabatan & status
- Naik/turun satu tingkat (▲▼) dan pindah jabatan langsung lewat form Edit
- Status ikut menyesuaikan saat jabatan dipindah manual (naik → Aktif bila sebelumnya Diturunkan, turun → Diturunkan)
- Validasi: nama wajib, hex unik + format, ID Discord unik + format 15–20 digit

**Bot Discord**
- `/struktur` — memperbarui embed struktur (dikirim ulang sebagai edit, bukan pesan baru)
- `/anggota` — `cari`, `tambah`, `naik`, `turun`, `status`, `hex`, `hapus`
- Menu klik-kanan **Tambah ke Central T** (parsing teks pendaftaran, maksimal 25 blok)
- **Auto-daftar lewat chat** di channel struktur, dengan baris `AKSI`:
  - `TAMBAH` (maks 25 orang per pesan), `UBAH`, `NAIK`, `TURUN`, `HAPUS`
  - `NAIK`/`TURUN` bisa lompat ke jabatan mana pun lewat `JABATAN :`
  - Balasan reaksi ✅ / ⚠️, alasan kegagalan dikirim sebagai pesan yang hilang sendiri (25 detik)
  - `HAPUS` selalu minta konfirmasi tombol
  - Format di dalam blok kode (` ``` `) juga diterima
- Embed struktur menampilkan **Steam Hex + ID Discord** (ID hanya bila tersimpan)
- Command didaftarkan otomatis di **semua server** yang diikuti bot

**Integrasi**
- Bot tidak menyentuh database langsung; semua lewat API web (`http://app:3001`) → Prisma → PostgreSQL
- Satu sumber data: perubahan dari bot langsung tampil di web (setelah refresh) dan sebaliknya

**Data per 14 Nov 2026**
- 65 anggota; 36 punya Steam Hex; 3 punya ID Discord
- Sebaran: OG 2, UNDER OG 2, BIG HOMIES 16, HOMIES 16, LIL HOMIES 29, TAMU 0

---

## 3. WD (Withdraw) — web & bot

### Web `/wd` (selesai)
- Ringkasan (dipinjam / **terlambat** / kembali bulan ini / hilang), filter status + rentang tanggal
  + pencarian (kode, nama, barang, SN), pagination 20/halaman.
- Form Ambil/Edit (anggota, barang, toggle senjata, SN, durab, qty, tanggal, keperluan).
- Modal Kembali (durab default = durab awal — **boleh sama**) dan modal Hilang (alasan wajib).
- Detail berisi format baku + tombol **Salin format**.

### Tenggat senjata 3 hari (baru, 14 Nov 2026)
- Setiap **senjata** yang diambil otomatis punya tenggat `takenAt + 3 hari` (`dueAt`).
  Non-senjata tidak punya tenggat.
- Status **terlambat** dihitung otomatis (`isOverdue`, `daysLate`, `daysLeft`) tanpa mengubah
  status database (tetap `DIPINJAM`).
- Web: kartu **Terlambat** (bisa diklik untuk filter), kolom **Tenggat** di tabel, preview tenggat
  di form, peringatan di modal kembali, dan info tenggat di detail.
- Bot: field **Tenggat kembali** di kartu, tanda ⚠️ di `/wd daftar` & `/wd cari`, balasan
  pengembalian menyebut keterlambatan.
- **Pengingat harian:** bot cek tiap 30 menit (`GET /api/wd?overdue=1`), kirim pesan
  ⚠️ **PENGEMBALIAN TERLAMBAT** ke channel WD (mention peminjam bila punya ID Discord),
  maksimal sekali per ~20 jam per transaksi (`reminder_at`).
- API: filter `overdue`, `POST /api/wd/[id]/reminder`, statistik `terlambat`.
- Pengembalian terlambat **tetap diterima** dan tercatat; tidak diblokir.

### Bot Discord (terpasang, channel sudah bisa diakses)
- Command: `/wd ambil`, `/wd kembali`, `/wd hilang`, `/wd cari`, `/wd daftar`
  (autocomplete anggota, saran nama barang, kode transaksi `DIPINJAM`).
- **Skema kartu = 2 pesan per transaksi:**
  1. **Kartu pengambilan** — format baku, `TGL PENGEMBALIAN`/`DURAB DIKEMBALIKAN` = `—`,
     footer 🟡 *Dipinjam*, tombol **✅ Kembalikan** / **⚠️ Tandai hilang**.
  2. **Kartu pengembalian/hilang** — pesan **baru** dengan format lengkap yang sama, tetapi
     tanggal & durab kembali sudah terisi, footer 🟢 *Dikembalikan* / 🔴 *Hilang*, tanpa tombol.
- Kartu pengambilan tidak diubah isinya; hanya tombolnya dicabut agar tidak diklik dua kali.
- `discord_message_id` menyimpan ID kartu terakhir → dipakai untuk edit & sinkronisasi.
- ✅ membuka modal: durab (default durab awal, boleh sama) + catatan kondisi; tanggal kembali
  otomatis hari ini (WIB). Tidak perlu mengetik format — bot mengisi lengkap dari database.
- Sinkronisasi web → Discord tiap 2 menit (`GET /api/wd?updatedAfter=`): kalau transaksi sudah
  kembali di web tetapi kartu pengambilan masih "Dipinjam", bot mengirim kartu pengembalian baru.
- API pendukung: `POST /api/wd/[id]/discord-message`, filter `updatedAfter` di `GET /api/wd`.

### Auto-catat WD dari chat (14 Nov 2026, sudah diuji)
- Bot membaca pesan format baku di channel WD (pola sama seperti auto-catat kegiatan):
  - **tanpa** `TGL PENGEMBALIAN` → dicatat sebagai **pengambilan** baru;
  - **dengan** `TGL PENGEMBALIAN` + `DURAB DIKEMBALIKAN` → dicari transaksi `DIPINJAM` yang cocok
    (utamakan **SN**, lalu nama + jenis barang) lalu ditandai **kembali**.
- Balasan: ✅ + kode WD & cara mengembalikan, atau ⚠️ + alasan + contoh format (hilang 25 detik);
  pengirim di luar allowlist → ⛔. Pesan yang sudah ✅ tidak diproses ulang walau diedit.
- Nama pendek dicocokkan prefix ke nama lengkap: `CT - IPAN` → **IPAN NAS**.
- Baris header `FORMAT PENGAMBILAN…` opsional (asal ≥4 label dikenali); `-`/`—`/`66%` diterima.
- Berkas: `bot/src/wd-format.js` (parser) + `bot/src/wd-message.js` (handler), dipasang di
  `MessageCreate` & `MessageUpdate` (`bot/src/index.js`).
- **Uji end-to-end** (14 Nov, dari Discord): `WD-20261112-001` — IPAN NAS · DA · SN
  `FWJ17932118690UM`, ambil 12/11 durab 66%, kembali 13/11 durab 44% → ✅ dua-duanya,
  status `DIKEMBALIKAN`, tampil di web.

### Uji & data
- API tenggat (14 Nov): buat senjata `takenAt=10/11` → `dueAt=13/11`, `isOverdue=true`,
  `daysLate=1`; filter `overdue=1` menemukan; `stats.terlambat=1`; `POST reminder` mengisi
  `reminder_at`; kembali `14/11` → `daysLate=1` dan tidak lagi terhitung terlambat; non-senjata
  `dueAt=null`; edit `takenAt` menghitung ulang tenggat. Semua lolos, data uji dihapus.
- Bot: simulasi `syncWdReminders` dengan channel tiruan → 1 pesan, run kedua tidak mengirim lagi,
  `reminder_at` terisi; embed kartu memuat field **Tenggat kembali**.
- `tsc --noEmit` bersih; `node --check` file bot OK; web `/wd` HTTP 200.
- Data WD (14 Nov 2026): **18 transaksi** hasil import stok DA — 16 `DIPINJAM`, 1 `DIKEMBALIKAN` (EXXEL), 1 `HILANG` (TYRONE SMITH). Tenggat mengikuti jadwal asli (03/06/08/09/12/15 Nov).
  Termasuk `WD-20261112-001` hasil uji auto-catat chat.

### ✅ Akses channel WD (diverifikasi 14 Nov 2026)
- Channel `🔫┃𝚆𝙷𝙸𝚃𝙳𝚁𝙰𝚆-𝙳𝙰` = `1567507915374460938`.
- Dicek lewat API Discord: bot bisa **View Channel, Send Messages, Add Reactions,
  Read Message History, Embed Links** (bukan Administrator).
- Kartu WD sekarang bisa dikirim; uji klik ✅ end-to-end dari Discord belum dijalankan
  (butuh interaksi manual).

---

## 4. Kegiatan — web & bot

### Web `/kegiatan` (selesai)
Ringkasan bulan ini, pencarian + filter tanggal, tabel 20/halaman, form peserta (anggota atau
nama manual), detail + **Salin format**. Rincian ada di `PRD-KEGIATAN.md`.

### Bot Discord (terpasang, channel siap)
- Channel: `👥┃𝙽𝙰𝙼𝙰-𝙰𝙽𝙶𝙶𝙾𝚃𝙰-𝚈𝙰𝙽𝙶-𝙸𝙺𝚄𝚃-𝙺𝙴𝙶𝙸𝙰𝚃𝙰𝙽` = `1568673636355670218`
  (`KEGIATAN_CHANNEL_ID`).
- Kirim format baku (`TANGGAL KEGIATAN` / `KEGIATAN` / `NEGOSIASI` / `NAMA ANGGOTA`) → bot
  mencatat ke database, membuat kode `KGT-YYYYMMDD-NNN`, lalu pesannya diberi reaksi ✅.
- Format salah → reaksi ⚠️ + balasan alasan + contoh format (hilang sendiri 25 detik);
  pengirim di luar allowlist → ⛔; chat biasa diabaikan.
- **Edit pesan = edit data yang sama** lewat `activities.discord_message_id` (unik), tidak dobel.
- Peserta dicocokkan ke anggota (nama persis, case-insensitive); yang tidak ada disimpan sebagai
  nama manual (PRD K1). Nama ganda di database → disimpan manual + dicatat di log bot.
- `/kegiatan rekap` — kegiatan bulan ini, peserta bulan ini, total, + 10 kegiatan terakhir.
- Uji: 8 kasus parser (`bot/test-kegiatan-parser.mjs`) + uji integrasi API
  create/edit/delete memakai pesan tiruan di container — semua lolos; `tsc --noEmit` bersih.
- ✅ **Akses channel diberikan (14 Nov 2026):** `CT - BOT` bisa View Channel, Read Message
  History, Add Reactions, Send Messages, Embed Links. Tinggal uji kirim format asli di channel.

---

## 5. Berangkas (sederhana, 14 Nov 2026)

- **Database:** tabel `vault_items` + enum `VaultStatus` (`SIAP`, `DIPINJAM`, `HILANG`, `RUSAK`).
  Satu baris = satu unit; SN unik untuk senjata; durab opsional (data lama boleh kosong).
  Migrasi: `prisma/migrations/20261114161000_add_vault_items`.
- **API:** `GET/POST /api/berangkas`, `GET/PATCH/DELETE /api/berangkas/[id]`,
  `GET /api/berangkas/stats`, `GET /api/berangkas/names`.
- **Web `/berangkas`:** kartu statistik (total/siap/dipinjam/hilang/rusak), pencarian + filter
  status, tabel (barang, SN, durab, status, catatan), form tambah/edit, hapus dengan konfirmasi,
  pagination 20/halaman.
- **Data 14 Nov 2026:** 18 unit **DA** (senjata) — 16 `DIPINJAM`, 1 `SIAP` (READY), 1 `HILANG` (SNX17932118670SB, denda 1x lipat). Durab terisi di 2 unit (66%, 80%), sisanya kosong. Rincian: `PRD-BERANGKAS.md`.
- **Sinkronisasi WD → Berangkas:** WD ambil (SN cocok) → unit `DIPINJAM`; kembali → `SIAP`;
  hilang → `HILANG`; hapus WD yang masih dipinjam → `SIAP`. Stok tersedia ikut berubah otomatis.
- **Belum:** import massal daftar SN, riwayat perubahan, qty untuk barang non-senjata.

---

## 6. Sisa pekerjaan

### 6.1 Struktur & Anggota (sisa 1%)
Prioritas dari atas:

1. **Log audit channel** — `LOG_CHANNEL_ID` masih kosong, jadi setiap perubahan tidak tercatat siapa pelakunya. Ini yang paling terasa risikonya karena bot & web tanpa login.
2. **Ubah urutan jabatan (`sortOrder`)** — belum ada UI; saat ini harus lewat SQL/Adminer.
3. **`positions.sort_order` tanpa unique constraint** — dua jabatan bisa punya urutan sama, membuat naik/turun melompat.
4. **Nama anggota belum unik** — belum ada pengecekan duplikat di web; bot hanya memeriksa dari 10 hasil pencarian pertama.
5. **Default status anggota baru berbeda** — web `AKTIF`, bot slash `TIDAK_DIKETAHUI`, auto-daftar `AKTIF`.
6. **Hint form Edit menyesatkan** — "Jabatan akan otomatis turun satu tingkat" tidak terjadi karena form selalu mengirim `positionId`.
7. **Hapus jabatan harus mengosongkan anggotanya satu per satu** — belum ada "pindahkan semua ke jabatan X".
8. **Turun jabatan dari web tanpa konfirmasi/undo** — satu klik langsung mengubah jabatan + status.
9. **Pembatasan role di channel pendaftaran** — belum diatur; saat ini penyaringan hanya dari allowlist bot.
10. **`/anggota ubah` dan `/anggota pindah` belum didaftarkan** — fungsinya hanya tersedia lewat format chat.
11. **Bot masih memegang `DISCORD_TOKEN` dari `.env` yang sama dengan web** — sebaiknya dipisah.
12. **Pagination `/anggota`** — belum ada, belum terasa di 65 anggota.

### 6.2 WD (yang belum)
1. **Uji klik ✅ end-to-end** — `/wd ambil` → kartu muncul di channel → klik ✅ → kartu
   pengembalian muncul → cek web. Akses channel sudah ada, tinggal interaksi manual.
2. **Koreksi transaksi** — setelah `DIKEMBALIKAN`/`HILANG` data terkunci. Rencana:
   `/wd batal-kembali` (balik ke `DIPINJAM`, hapus kartu pengembalian, pulihkan tombol) +
   tombol "Batalkan pengembalian" di web. **Belum dibuat** (diputuskan menyusul).
3. **WD dari web tidak membuat kartu Discord** — hanya `/wd ambil` yang memposting kartu;
   transaksi dari web tidak muncul di channel.
4. **`/wd daftar`** hanya 20 baris, belum ada pagination.
5. **Log audit WD** — `LOG_CHANNEL_ID` kosong; pelaku perubahan tidak tercatat.
6. **Master barang** — nama barang masih teks bebas; relasi katalog belum ada (integrasi status Berangkas ↔ WD sudah jalan).
7. **Tes otomatis** — sudah ada uji API tenggat + simulasi pengingat; alur klik tombol belum.

### 6.3 Kegiatan (yang belum)
1. **Uji kirim format asli** di channel kegiatan (akses bot sudah ada).
2. **`/kegiatan catat` dan `/kegiatan impor`** (backfill pesan lama) — belum dibuat.
3. **Sinkron web → Discord** — edit/hapus dari web belum mengubah pesan Discord (baru berlaku
   pada alur edit pesan).
4. **Log audit kegiatan** — `LOG_CHANNEL_ID` kosong; pelaku perubahan tidak tercatat.
5. **Rekap lanjutan** — per anggota, grafik bulanan, export CSV.

---

## 7. Konfigurasi aktif

| Env | Nilai | Keterangan |
|---|---|---|
| `DISCORD_GUILD_ID` | `1541970119129833552` | Server Central T |
| `STRUKTUR_CHANNEL_ID` | `1570765829581054073` | Channel `🌐┃𝚂𝚃𝚁𝚄𝙺𝚃𝚄𝚁-𝙲𝚃` |
| `DAFTAR_CHANNEL_ID` | `1570765829581054073` | Auto-daftar dari chat (channel yang sama) |
| `WD_CHANNEL_ID` | `1567507915374460938` | Channel `🔫┃𝚆𝙷𝙸𝚃𝙳𝚁𝙰𝚆-𝙳𝙰` — akses bot sudah diberikan |
| `KEGIATAN_CHANNEL_ID` | `1568673636355670218` | Channel `👥┃𝙽𝙰𝙼𝙰-𝙰𝙽𝙶𝙶𝙾𝚃𝙰-𝚈𝙰𝙽𝙶-𝙸𝙺𝚄𝚃-𝙺𝙴𝙶𝙸𝙰𝚃𝙰𝙽` — akses bot sudah diberikan |
| `ALLOWED_ROLE_IDS` | `1541988598717354105` | Role BIG HOMIES |
| `ALLOWED_USER_IDS` | `994798708812161055`, `1428649915189428244` | Pemilik + 1 teman |
| `LOG_CHANNEL_ID` | kosong | Belum diaktifkan |
| `WD_REMINDER_ENABLED` | `0` | Pengingat "PENGEMBALIAN TERLAMBAT" di channel WD — **mati** sejak 16 Nov 2026 |

Catatan: `Message Content Intent` **wajib aktif** di Developer Portal untuk auto-daftar dan
auto-catat kegiatan.

---

## 8. Cara deploy & cek

```powershell
cd C:\Users\irfan\Documents\CT\central-t
docker compose --profile app up -d --build app bot   # setelah ubah kode web/bot
docker logs -t --tail 20 central-t-bot                # cek log bot
docker exec central-t-db psql -U centralt -d centralt -c "select count(*) from members;"
```

Cek cepat setelah deploy:

```powershell
# web hidup?
Invoke-WebRequest http://localhost:3001/wd -UseBasicParsing | Select-Object StatusCode

# API WD + filter sinkronisasi
Invoke-RestMethod "http://localhost:3001/api/wd?updatedAfter=2026-11-14T00:00:00Z&pageSize=5" | ConvertTo-Json -Depth 3
```

Melihat menu bot yang aktif (dari sisi Discord, bukan asumsi):

```powershell
$tok = ((Get-Content .env | Select-String '^DISCORD_TOKEN=').Line -replace '^DISCORD_TOKEN=','')
curl.exe -s -H "Authorization: Bot $tok" "https://discord.com/api/v10/applications/1570379537743872081/guilds/1541970119129833552/commands"
```

---

## 9. Berikutnya (WD & kegiatan sudah aktif)

1. **Kegiatan**: uji kirim format asli di channel → baru lanjut `/kegiatan catat` + impor pesan lama.
2. **WD**: uji klik ✅ end-to-end → koreksi (`batal-kembali`) → master barang.
3. **Berangkas**: isi data stok (DA) -> integrasi WD (status unit otomatis) -> import massal SN.

---

## 10. Redesain UI — "kertas & tinta" (15 Nov 2026)

**Kenapa.** Logo Central T adalah gambar tinta hitam (engraving) dengan latar transparan. Di atas
latar hitam, hanya highlight putihnya yang terlihat sehingga logo tampak bayangan pucat; aksen
putih-hitam juga membuat teks 11–13px low-contrast dan aksi disembunyikan di balik hover.
Arah baru diturunkan dari asetnya sendiri: kertas, tinta, garis rambut 1px.

**Aturan visual (jangan dilanggar saat menambah halaman):**

| Hal | Aturan |
|---|---|
| Latar | `bg-paper` (#f7f6f2) untuk halaman, `bg-surface` (#fff) untuk panel |
| Teks | `text-ink` (utama), `text-ink-2` (sekunder), `text-ink-3` (meta) |
| Garis | `border-line` / `border-line-2`, radius `rounded-card` (10px) & `rounded-field` (8px) |
| Warna | Hanya untuk status: `ok` / `warn` / `bad` + `*-soft`. Tidak ada gradien/bayangan dekoratif |
| Ikon | SVG dari `src/components/icons.tsx` (16px, stroke 1.8). **Emoji tidak dipakai sebagai ikon** |
| Angka | class `tnum` (tabular) untuk qty, durab, tanggal, statistik |
| Mono | Hanya Hex/SN/kode transaksi |

**File yang berubah:** `app/globals.css` (token + `@theme inline`), `components/icons.tsx` (baru),
`components/{ui,modal,toast,nav}.tsx`, seluruh `app/**/page.tsx`, `components/{member,kegiatan,wd,vault}-*`,
`components/member-picker.tsx`, `components/participant-picker.tsx`, `lib/types.ts` (class badge).

**Perubahan per halaman**

- **`/` Struktur** — papan chip padat: satu baris per jabatan, chip 160×30 px, status berupa titik
  warna. **65 anggota muat tanpa scroll** pada 1366×768 (diukur: `scrollHeight` = `innerHeight`).
  Klik chip → panel kanan berisi jabatan, Steam Hex (salin), ID Discord, dan tombol Naik/Turun/Edit/Hapus.
  Tombol **Hex** menampilkan hex di dalam chip (chip jadi 40px, boleh scroll).
- **`/anggota`** — satu tabel dengan baris pemisah per jabatan (sebelumnya header tabel diulang 6×).
- **`/wd`** — 4 angka ringkas (kartu "Terlambat" tetap bisa diklik jadi filter), tabel 10 kolom,
  baris terlambat diberi latar `warn-soft`.
- **`/kegiatan`, `/berangkas`, `/positions`** — pola yang sama; `/positions` kini punya tautan di navbar.
- **Aksesibilitas**: tombol ikon selalu punya `aria-label`, status punya teks `sr-only`, fokus
  keyboard terlihat (`:focus-visible` 2px), animasi dimatikan pada `prefers-reduced-motion`.

**Verifikasi (15 Nov 2026):** `tsc --noEmit` bersih; 6 rute mengembalikan 200; screenshot headless
Edge 1440×900 & 1366×768 untuk keenam halaman.

**Deploy:** tampilan ini ada di source, jadi container harus dibangun ulang —
`docker compose --profile app up -d --build app`.

---

## 11. Pindah ke port 3001 (16 Nov 2026)

Port **3000 = versi lama**, port **3001 = versi baru**. Sekarang web, bot, dan skrip uji
semuanya mengarah ke **3001**; port 3000 tidak dipakai lagi.

| Berkas | Perubahan |
|---|---|
| `src` / `docker-compose.yml` | `app` dipetakan `3001:3001` (sebelumnya `3000:3000`) |
| `Dockerfile` | `ENV PORT=3001`, `EXPOSE 3001` |
| `package.json` | `dev`/`start` memakai `-p 3001` |
| `docker-compose.yml` | bot: `API_URL: http://app:3001` |
| `bot/src/api.js` | default `http://localhost:3001` (dipakai saat bot dijalankan di host) |
| `scripts/*.mjs` | default `BASE_URL`/`base` → `localhost:3001` |

**Database tidak ikut pindah:** `/` (struktur) dan `/anggota` tidak menyimpan host/port sendiri —
keduanya memanggil `/api/...` di origin yang sama → Prisma → `DATABASE_URL`. PostgreSQL tetap
di `localhost:5432` (volume Docker `central-t_central_t_pgdata`), karena 3001 adalah port HTTP
aplikasi, bukan port database.

**Verifikasi (16 Nov 2026):** `npx tsc --noEmit` bersih; `node --check` semua file bot OK;
container `central-t-app` listen `3001:3001`, `no pending migrations`; `GET /`, `/anggota`,
`/positions`, `/api/members`, `/api/positions` → HTTP 200 dengan data asli (65 anggota, 6 jabatan);
port 3000 sudah tidak ada yang jalan; `docker exec central-t-bot printenv API_URL` =
`http://app:3001`; log bot `login sebagai CT - BOT#2687`, 5 command terdaftar di 2 server,
struktur diperbarui, pengingat WD terkirim.

---

## 12. Sinkronisasi anggota dari Google Sheet (16 Nov 2026)

`scripts/import-sheet.mjs` ditulis ulang. Sheet sumber:
`https://docs.google.com/spreadsheets/d/129hfdDSgPnvrEAyN5hjny8pip_P3iDjMykSg2Vi7Bzs` (gid 0).

**Kenapa ditulis ulang:** sheet memakai **dua blok dengan kolom berbeda** — kiri
(`No|Nama|Jabatan|Steam hex|ID DISCORD|Status`) dan kanan (`No|Nama|Jabatan|PJ|Status`, tanpa hex).
Script lama menganggap keduanya sama, sehingga "Status" blok kiri terbaca sebagai ID Discord dan
"PJ" blok kanan terbaca sebagai hex. Script lama juga **hanya menambah** (nama yang sudah ada
dilewati), jadi tidak pernah memperbarui apa pun.

**Kemampuan baru**

| Perintah | Arti |
|---|---|
| `node scripts/import-sheet.mjs` | simulasi, tidak menulis apa pun |
| `... --apply` | buat yang baru + perbarui jabatan/status/hex/ID Discord yang berbeda |
| `... --apply --prune` | + **hapus** anggota yang tidak ada di sheet (database jadi = sheet) |
| `... --force` | tetap buat walau namanya mirip anggota lain |

- Normalisasi: `steam:` didahulukan, spasi dibuang (`steam: 1100…` → `steam:1100…`), ID Discord
  diambil digitnya saja, `Sepuh/OG` dikenali sebagai `OG`.
- Hex / ID Discord dobel di dalam sheet: yang pertama dipakai, sisanya dikosongkan + dicatat.
- Nama beda ejaan (`ANAXKYY` vs `ANAXKY (ZAKYY)`, `MEIO RAY (JONO)` vs `MEIO RAY`) dicocokkan,
  tidak dibuat duplikat. `--prune` memakai penanda "sudah tercocokkan", bukan nama, supaya
  orang yang cocok sebagian tidak ikut terhapus.
- Status & jabatan selalu dikirim bersamaan, jadi aturan otomatis "turun jabatan → DITURUNKAN"
  di `updateMember` tidak ikut menimpa status dari sheet.

**Hasil 16 Nov 2026** (backup dulu: `CT\backup-centralt-20261116-1849.sql`):

| | |
|---|---|
| Dibuat | 2 — LEONARDO DAVINCI, GLOW GLOWY KINGSTON |
| Diperbarui | 51 (hex/ID Discord terisi, status, pindah jabatan) |
| Dihapus (`--prune`) | 12 anggota yang tidak ada di sheet |
| Total akhir | **55 anggota** = sheet: OG 2, UNDER OG 2, BIG HOMIES 14, HOMIES 28, LIL HOMIES 9, TAMU 0 |
| Hex / ID Discord terisi | 45 / 45 |

**Efek samping:** 5 baris WD dan 12 peserta kegiatan yang dulu menunjuk anggota yang dihapus
sekarang `member_id = NULL` (relasi `onDelete: SetNull`) — transaksi/kegiatannya tetap ada,
hanya tautan ke anggotanya kosong.

**Verifikasi:** run kedua `--apply --prune` → `baru 0 · diperbarui 0 · tetap 55` (idempoten);
tidak ada nama duplikat; `/anggota` menampilkan 55 anggota.

### Koreksi kepemilikan hex & ID Discord (16 Nov 2026)

Sheet baris 19 (`EXXEL OSAZE C VERHOVEN`) dan baris 38 (`CECILLIA ZEE VERHOEVEN`) memuat
**Steam Hex dan ID Discord yang sama**: `steam:11000016c97015a` / `1311703875488841858`.
Karena `hex` dan `discord_id` **UNIQUE**, importer hanya menyimpan yang pertama (Exxel) dan
mengosongkan yang kedua — itu sebabnya Cecillia tampil `—` di bot.

Dicek langsung ke Discord API (`GET /guilds/{guild}/members/1311703875488841858`): ID itu milik
**CT - CECILZ** (`only.cecilz`) — jadi data tersebut **milik Cecillia**, dan baris Exxel yang salah.

| Anggota | Sebelum | Sesudah |
|---|---|---|
| CECILLIA ZEE VERHOEVEN | `—` / `—` | `steam:11000016c97015a` / `1311703875488841858` |
| EXXEL OSAZE C VERHOVEN | `steam:11000016c97015a` / `1311703875488841858` | `—` / `—` (menunggu data asli) |

**Yang masih harus dilakukan di sheet:** kosongkan kolom Steam hex & ID DISCORD di **baris 19**
(Exxel). Selama belum, setiap sync akan mencoba memberi data Cecillia ke Exxel dan gagal
(409 `Steam Hex sudah dipakai`) — data database tetap benar, hanya laporan sync yang gagal 1 baris.

### Rekonsiliasi penuh sheet vs database (16 Nov 2026, sore)

Sheet sudah diperbaiki pemilik: baris 19 (Exxel) kini punya hex sendiri
(`steam:11000016f742e0e`, sebelumnya memakai hex Cecillia). Setelah disinkronkan:

| Hal | Hasil |
|---|---|
| Nama | `MEIO RAY` di database diubah jadi **`MEIO RAY (JONO)`** agar sama dengan sheet |
| Hex Exxel | `steam:11000016f742e0e` (hex baru dari sheet) — sudah masuk database & embed |
| Hex/ID Cecillia | tetap miliknya: `steam:11000016c97015a` / `1311703875488841858` |
| **Selisih tersisa** | **1 sel**: kolom ID DISCORD baris 19 (Exxel) berisi `76561199830150670` |

**Kenapa sel itu tidak disalin:** angka itu bukan ID Discord, melainkan **SteamID64** yang
dihitung dari Steam Hex Exxel sendiri — `0x11000016f742e0e` = `76561199830150670` (terbukti
identik). Jadi kolomnya salah isi. Supaya kasus ini tidak pernah masuk database,
`scripts/import-sheet.mjs` sekarang **mengabaikan** nilai "ID DISCORD" yang sama dengan SteamID64
dari hex orang yang sama, dan menuliskannya di laporan:

```
baris 19: "ID DISCORD" 76561199830150670 = SteamID64 dari hex-nya, bukan ID Discord -> diabaikan (EXXEL OSAZE C VERHOVEN)
```

**Alat baru:** `node scripts/compare-sheet.mjs` membandingkan sheet vs database per field
(nama, jabatan, status, hex, ID Discord) dan keluar dengan kode 1 bila ada selisih.
Hasil 16 Nov 2026: `sheet: 55 baris · database: 55 anggota · cocok: 54` — selisihnya hanya sel
SteamID64 di atas. Untuk membuat angka itu 55/55, isi kolom ID DISCORD baris 19 dengan ID Discord
Exxel yang sebenarnya (atau kosongkan).

---

## 13. Pengingat "PENGEMBALIAN TERLAMBAT" dimatikan (16 Nov 2026)

Pengingat otomatis di channel WD dihentikan dan pesan yang sudah terkirim dibersihkan.

**Cara mematikan** — flag `WD_REMINDER_ENABLED`, default **mati**:

| Berkas | Perubahan |
|---|---|
| `.env` | `WD_REMINDER_ENABLED=0` |
| `docker-compose.yml` | bot: `WD_REMINDER_ENABLED: ${WD_REMINDER_ENABLED:-0}` |
| `bot/src/index.js` | pemanggilan awal & `setInterval` 30 menit hanya jalan bila flag `= 1`; log `[wd] pengingat terlambat nonaktif` |
| `bot/src/wd.js` | `doRemind()` langsung `return` bila flag bukan `1` (pengaman lapis kedua) |

**Yang TIDAK diubah:** fitur tenggat 3 hari tetap ada — kolom **Tenggat** di `/wd`, tanda ⚠️ di
`/wd daftar` & `/wd cari`, keterangan terlambat di modal kembali, serta endpoint
`POST /api/wd/[id]/reminder` dan kolom `reminder_at`. Yang dimatikan hanya **pesan otomatis**
ke channel WD. Untuk menghidupkan lagi: set `WD_REMINDER_ENABLED=1` lalu rebuild bot.

**Pembersihan pesan:** 30 notif `⚠️ PENGEMBALIAN TERLAMBAT` dihapus lewat Discord API
(`DELETE /channels/{id}/messages/{id}`, 3 kena rate limit lalu diulang). Hasil akhir: channel WD
**0 pesan dari bot**, 17 pesan anggota tersisa. Kartu WD tidak ada yang terhapus (saat itu channel
memang tidak berisi kartu).

**Verifikasi:** `docker exec central-t-bot printenv WD_REMINDER_ENABLED` → `0`; log bot memuat
`[wd] pengingat terlambat nonaktif (WD_REMINDER_ENABLED != 1)`; struktur Discord tetap
diperbarui (fitur lain tidak terganggu).

---

## 14. Tampilan embed struktur Discord dirapikan (16 Nov 2026)

Embed `/struktur` lama sulit dibaca: satu anggota ditulis satu baris
(`🟢 **NAMA** — \`hex\` — \`18-digit\``) sehingga entri panjang **melipat di tengah**
(contoh: `EXXEL OSAZE C VERHOVEN — steam:… —` lalu ID-nya jatuh ke baris berikutnya), status hanya
berupa warna, dan header cuma "Total 55 anggota" + legenda tanpa angka.

**Aturan desain yang dipakai** (dari `ui-ux-pro-max`): jangan sampaikan info lewat warna saja
(High), dan jangan biarkan token panjang memaksa wrap/overflow (High).

**Bentuk akhir** — tabel monospace satu baris per anggota di dalam blok kode:
emoji status, nama, lalu `| steam:hex | id`. Nomor urut tidak dipakai.

```
🟢 ESER EX MACHINA        | steam:110000146b0a811 | 832905294383415297
⚫ ALFA ROMEO             | steam:11000015a41252d | 1324095888355754015
```

**Soal lebar:** satu baris ini **70 karakter**. Muat selama jendela Discord cukup lebar
(±900px pada zoom 100%); di jendela sempit ID akan terdorong ke baris sendiri. Kalau itu terjadi,
pilihannya: lebarkan/zoom-out jendela, atau kembali ke varian dua baris (nama di baris 1,
`hex | id` di baris 2, total 43 karakter) — riwayat perubahan ini ada di git.

Format dibuat di `bot/src/struktur-format.js` (modul murni, tanpa `discord.js`, supaya bisa diuji
lokal); `bot/src/struktur.js` hanya mengurus kirim/edit pesan.

| Hal | Sebelum | Sesudah |
|---|---|---|
| Satu anggota | 2 baris (nama+status, lalu hex+ID) | **1 baris**: `🟢 NAMA \| steam:hex \| id` |
| Status per anggota | kata (`— Aktif`) | emoji saja (🟢 ⚫ 🔴 ⚪) + jumlah per status di header |
| Nomor urut | 1–55 | tidak dipakai |
| Lebar baris | 43 karakter (2 baris) | **70 karakter** (1 baris) |
| Kolom | rata | rata (blok kode + monospace, nama di-pad) |
| Hex kosong / ID kosong | diisi `—` | diisi `—` |
| Header | "Total 55 anggota" + 4 titik warna | `**55 anggota** · 6 jabatan` + jumlah per status (38 / 17 / 0 / 0) |
| Judul seksi | `OG (2)` | `OG — 2 anggota` |
| Jumlah pesan | 3 pesan | **1 pesan, 7 embed** |

Anggota tidak pernah terbelah antar-embed (batas 3800 karakter/embed, 5500/pesan). Jabatan kosong
ditulis `(belum ada anggota)`.

**Verifikasi (16 Nov 2026):** `node --check` OK; bot di-rebuild; dibaca ulang lewat Discord API →
1 pesan, 7 embed, 56 baris, lebar 70–71 karakter, footer `CT-STRUKTUR • 1/1` utuh sehingga
edit-in-place tetap jalan.

---

## 15. Riwayat perubahan anggota (audit) — 16 Nov 2026

Sebelumnya tidak ada jejak siapa mengubah apa (§6.1 poin 1): bot & web tanpa login. Sekarang setiap
perubahan anggota dicatat ke database dan bisa dilihat di halaman **`/anggota`**.

**Data** — tabel `member_audits` (migrasi `20261116190000_add_member_audits`):

| Kolom | Isi |
|---|---|
| `member_id`, `member_name` | id anggota (NULL kalau sudah dihapus) + nama saat itu |
| `action` | `CREATE` / `UPDATE` / `DELETE` / `PROMOTE` / `DEMOTE` |
| `source` | `WEB` atau `DISCORD` |
| `actor_id`, `actor_name` | pelaku (diisi bot; kosong untuk web) |
| `changes` | JSON `{ field: { from, to } }` — field: nama, jabatan, status, hex, discord |

Tidak memakai relasi ke `Member`, jadi riwayat **tetap ada setelah anggotanya dihapus**.

**Cara bot memperkenalkan dirinya.** Tidak ada login, jadi bot mengirim identitas lewat header pada
setiap mutasi anggota (`bot/src/api.js` → `actorOf()`):

```
x-actor-source: discord
x-actor-id: 994798708812161055
x-actor-name: <nama tampilan, URL-encoded>
```

`src/lib/audit.ts` (`actorFromRequest`) membacanya; tanpa header itu perubahan dianggap dari web.
Titik yang sudah mengirim identitas: `/anggota` tambah/ubah/pindah/naik/turun/status/hex
(`bot/src/index.js`), tombol tambah & menu klik-kanan (`tambah.js`), hapus (`hapus.js`),
auto-daftar dari chat (`daftar.js`).

**Tampilan** — `src/components/audit-history.tsx`, dibuka dari `/anggota`:
- tombol **Riwayat** di kanan atas → 60 perubahan terakhir semua anggota;
- ikon jam di tiap baris → riwayat anggota itu saja;
- bisa ditautkan: `/anggota?riwayat=all` (semua) atau `/anggota?riwayat=<memberId>`.

Baris riwayat menampilkan waktu (WIB), aksi, nama anggota, perubahan per field
(`Status: Aktif → Tidak Aktif`), dan pelaku (`Uji Riwayat`, `Web`, dst).

**Verifikasi (16 Nov 2026):** dibuat anggota uji lewat API dengan header bot → tercatat
`CREATE · DISCORD · CT - Irfan`; diubah tanpa header → `UPDATE · WEB`; naik jabatan dari bot →
`PROMOTE · DISCORD · LIL HOMIES → HOMIES`; dihapus → `DELETE · WEB` dengan member_id NULL.
`tsc --noEmit` bersih, semua file bot lolos `node --check`, UI dicek lewat screenshot
`/anggota?riwayat=all`. Baris uji sudah dihapus, jadi riwayat mulai kosong.

**Beda dengan log channel Discord:** `LOG_CHANNEL_ID` masih kosong — riwayat ini tersimpan di
database dan tampil di web, bukan dikirim sebagai pesan ke channel log.

