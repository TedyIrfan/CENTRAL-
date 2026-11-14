# PROGRESS — Central T

Catatan progres per modul. Terakhir diperbarui: **14 Nov 2026**.

Status modul **Struktur & Anggota** menurut pemilik proyek: **99% selesai** (belum ditutup).
Modul **WD (Withdraw)** selesai di web dan bot-nya sudah terpasang, tetapi **kartu Discord belum
aktif** karena channel WD masih privat (detail di §3–§4).

---

## 1. Status antar modul

| Modul | Web | Bot Discord | Status |
|---|---|---|---|
| **Struktur & Anggota** | ✅ selesai | ✅ selesai | **99%** — tinggal penyelesaian kecil |
| **WD (Withdraw)** | ✅ selesai | ⚠️ terpasang, kartu belum aktif | menunggu izin channel WD |
| Kegiatan | ✅ selesai | ❌ belum | bot belum mulai |
| Berangkas | ⚠️ placeholder ("segera hadir") | – | belum dibangun |

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
- Bot tidak menyentuh database langsung; semua lewat API web (`http://app:3000`) → Prisma → PostgreSQL
- Satu sumber data: perubahan dari bot langsung tampil di web (setelah refresh) dan sebaliknya

**Data per 14 Nov 2026**
- 65 anggota; 36 punya Steam Hex; 3 punya ID Discord
- Sebaran: OG 2, UNDER OG 2, BIG HOMIES 16, HOMIES 16, LIL HOMIES 29, TAMU 0

---

## 3. WD (Withdraw) — web & bot

### Web `/wd` (selesai)
- Ringkasan (dipinjam / kembali bulan ini / hilang), filter status + rentang tanggal + pencarian
  (kode, nama, barang, SN), pagination 20/halaman.
- Form Ambil/Edit (anggota, barang, toggle senjata, SN, durab, qty, tanggal, keperluan).
- Modal Kembali (durab default = durab awal — **boleh sama**) dan modal Hilang (alasan wajib).
- Detail berisi format baku + tombol **Salin format**.

### Bot Discord (kode selesai, belum aktif)
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
- API pendukung baru: `POST /api/wd/[id]/discord-message`, filter `updatedAfter` di `GET /api/wd`.

### Uji & data
- Smoke test API: `GET /api/wd?updatedAfter=…` OK, `POST /api/wd/[id]/discord-message` 404 untuk
  ID tidak ada, web `/wd` HTTP 200.
- `tsc --noEmit` bersih; `node --check` untuk file bot OK.
- Data WD saat ini: 2 transaksi (dua-duanya sudah kembali), 0 dipinjam.
- **Belum diuji end-to-end dari Discord** (klik ✅ → kartu kembali) karena blocker di bawah.

### ⚠️ Blocker: bot belum punya akses channel WD
- Channel `🔫┃𝚆𝙷𝙸𝚃𝙳𝚁𝙰𝚆-𝙳𝙰` = **`1567507915374460938`** (sudah diisi di `.env` sebagai
  `WD_CHANNEL_ID`), tetapi channel-nya **privat**: `@everyone` di-deny *View Channel* dan hanya
  10 user yang diizinkan (tanpa role).
- Bot (`CT - BOT`) belum ada di permission overwrite channel → `403 Missing Access`.
  Akibatnya `/wd ambil` tetap tercatat di database & tampil di web, tetapi kartu gagal dikirim.
- **Tindakan:** tambahkan `CT - BOT` di *Edit Channel → Permissions* dengan izin
  **View Channel, Send Messages, Embed Links, Read Message History**.

---

## 4. Sisa pekerjaan

### 4.1 Struktur & Anggota (sisa 1%)
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

### 4.2 WD (yang belum)
1. **Aktifkan kartu Discord** — beri `CT - BOT` akses ke channel WD, lalu uji end-to-end:
   `/wd ambil` → klik ✅ → kartu pengembalian muncul → cek web.
2. **Koreksi transaksi** — setelah `DIKEMBALIKAN`/`HILANG` data terkunci. Rencana:
   `/wd batal-kembali` (balik ke `DIPINJAM`, hapus kartu pengembalian, pulihkan tombol) +
   tombol "Batalkan pengembalian" di web. **Belum dibuat** (diputuskan menyusul).
3. **WD dari web tidak membuat kartu Discord** — hanya `/wd ambil` yang memposting kartu;
   transaksi dari web tidak muncul di channel.
4. **`/wd daftar`** hanya 20 baris, belum ada pagination.
5. **Log audit WD** — `LOG_CHANNEL_ID` kosong; pelaku perubahan tidak tercatat.
6. **Master barang/Berangkas** — nama barang masih teks bebas + saran dari transaksi lama.
7. **Tes otomatis** — belum ada tes untuk alur kartu/tombol; baru smoke test API.

---

## 5. Konfigurasi aktif

| Env | Nilai | Keterangan |
|---|---|---|
| `DISCORD_GUILD_ID` | `1541970119129833552` | Server Central T |
| `STRUKTUR_CHANNEL_ID` | `1570765829581054073` | Channel `🌐┃𝚂𝚃𝚁𝚄𝙺𝚃𝚄𝚁-𝙲𝚃` |
| `DAFTAR_CHANNEL_ID` | `1570765829581054073` | Auto-daftar dari chat (channel yang sama) |
| `WD_CHANNEL_ID` | `1567507915374460938` | Channel `🔫┃𝚆𝙷𝙸𝚃𝙳𝚁𝙰𝚆-𝙳𝙰` — **privat, bot belum punya akses** |
| `ALLOWED_ROLE_IDS` | `1541988598717354105` | Role BIG HOMIES |
| `ALLOWED_USER_IDS` | `994798708812161055`, `1428649915189428244` | Pemilik + 1 teman |
| `LOG_CHANNEL_ID` | kosong | Belum diaktifkan |

Catatan: `Message Content Intent` **wajib aktif** di Developer Portal untuk fitur auto-daftar.

---

## 6. Cara deploy & cek

```powershell
cd C:\Users\irfan\Documents\CT\central-t
docker compose --profile app up -d --build app bot   # setelah ubah kode web/bot
docker logs -t --tail 20 central-t-bot                # cek log bot
docker exec central-t-db psql -U centralt -d centralt -c "select count(*) from members;"
```

Cek cepat setelah deploy:

```powershell
# web hidup?
Invoke-WebRequest http://localhost:3000/wd -UseBasicParsing | Select-Object StatusCode

# API WD + filter sinkronisasi
Invoke-RestMethod "http://localhost:3000/api/wd?updatedAfter=2026-11-14T00:00:00Z&pageSize=5" | ConvertTo-Json -Depth 3
```

Melihat menu bot yang aktif (dari sisi Discord, bukan asumsi):

```powershell
$tok = ((Get-Content .env | Select-String '^DISCORD_TOKEN=').Line -replace '^DISCORD_TOKEN=','')
curl.exe -s -H "Authorization: Bot $tok" "https://discord.com/api/v10/applications/1570379537743872081/guilds/1541970119129833552/commands"
```

---

## 7. Berikutnya (setelah WD aktif)

1. **WD**: aktifkan akses channel → uji end-to-end → koreksi (`batal-kembali`) → master barang.
2. **Kegiatan di Discord** — `/kegiatan catat`, `/kegiatan rekap`; perlu migrasi
   `discord_message_id` untuk `activities`.
3. **Berangkas** — halaman masih placeholder.
