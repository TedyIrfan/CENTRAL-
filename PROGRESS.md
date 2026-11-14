# PROGRESS — Central T

Catatan progres per modul. Terakhir diperbarui: **14 Nov 2026**.

Status modul **Struktur & Anggota** menurut pemilik proyek: **99% selesai** (belum ditutup). Detail sisa 1% ada di bawah.

---

## 1. Status antar modul

| Modul | Web | Bot Discord | Status |
|---|---|---|---|
| **Struktur & Anggota** | ✅ selesai | ✅ selesai | **99%** — tinggal penyelesaian kecil |
| WD (Withdraw) | ✅ selesai | ❌ belum | bot belum mulai |
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

## 3. Sisa 1% (belum selesai)

Prioritas dari atas:

1. **Log audit channel** — `LOG_CHANNEL_ID` masih kosong, jadi setiap perubahan tidak tercatat siapa pelakunya. Ini yang paling terasa risikonya karena bot & web tanpa login.
2. **Commit kode** — perubahan bot (`daftar.js`, `hapus.js`, `commands.js`, `index.js`, `struktur.js`, `tambah.js`, `docker-compose.yml`) dan web (form anggota, `members.ts`, dll.) masih belum di-commit.
3. **Ubah urutan jabatan (`sortOrder`)** — belum ada UI; saat ini harus lewat SQL/Adminer.
4. **`positions.sort_order` tanpa unique constraint** — dua jabatan bisa punya urutan sama, membuat naik/turun melompat.
5. **Nama anggota belum unik** — belum ada pengecekan duplikat di web; bot hanya memeriksa dari 10 hasil pencarian pertama.
6. **Default status anggota baru berbeda** — web `AKTIF`, bot slash `TIDAK_DIKETAHUI`, auto-daftar `AKTIF`.
7. **Hint form Edit menyesatkan** — "Jabatan akan otomatis turun satu tingkat" tidak terjadi karena form selalu mengirim `positionId`.
8. **Hapus jabatan harus mengosongkan anggotanya satu per satu** — belum ada "pindahkan semua ke jabatan X".
9. **Turun jabatan dari web tanpa konfirmasi/undo** — satu klik langsung mengubah jabatan + status.
10. **Pembatasan role di channel pendaftaran** — belum diatur; saat ini penyaringan hanya dari allowlist bot.
11. **`/anggota ubah` dan `/anggota pindah` belum didaftarkan** — fungsinya hanya tersedia lewat format chat.
12. **Bot masih memegang `DISCORD_TOKEN` dari `.env` yang sama dengan web** — sebaiknya dipisah.
13. **Pagination `/anggota`** — belum ada, belum terasa di 65 anggota.

---

## 4. Konfigurasi aktif

| Env | Nilai | Keterangan |
|---|---|---|
| `DISCORD_GUILD_ID` | `1541970119129833552` | Server Central T |
| `STRUKTUR_CHANNEL_ID` | `1570765829581054073` | Channel `🌐┃𝚂𝚃𝚁𝚄𝙺𝚃𝚄𝚁-𝙲𝚃` |
| `DAFTAR_CHANNEL_ID` | `1570765829581054073` | Auto-daftar dari chat (channel yang sama) |
| `ALLOWED_ROLE_IDS` | `1541988598717354105` | Role BIG HOMIES |
| `ALLOWED_USER_IDS` | `994798708812161055`, `1428649915189428244` | Pemilik + 1 teman |
| `LOG_CHANNEL_ID` | kosong | Belum diaktifkan |

Catatan: `Message Content Intent` **wajib aktif** di Developer Portal untuk fitur auto-daftar.

---

## 5. Cara deploy & cek

```powershell
cd C:\Users\irfan\Documents\CT\central-t
docker compose --profile app up -d --build app bot   # setelah ubah kode
docker logs -t --tail 20 central-t-bot                # cek log bot
docker exec central-t-db psql -U centralt -d centralt -c "select count(*) from members;"
```

Melihat menu bot yang aktif (dari sisi Discord, bukan asumsi):

```powershell
$tok = ((Get-Content .env | Select-String '^DISCORD_TOKEN=').Line -replace '^DISCORD_TOKEN=','')
curl.exe -s -H "Authorization: Bot $tok" "https://discord.com/api/v10/applications/1570379537743872081/guilds/1541970119129833552/commands"
```

---

## 6. Berikutnya (setelah Struktur & Anggota ditutup)

1. **WD di Discord** — `/wd ambil`, `/wd kembali`, `/wd cari`, `/wd daftar`; embed di channel WD + `discord_message_id` sudah disiapkan di skema.
2. **Kegiatan di Discord** — `/kegiatan catat`, `/kegiatan rekap`; perlu migrasi `discord_message_id` untuk `activities`.
3. **Berangkas** — halaman masih placeholder.
