const MAX_PARTICIPANTS = 50;
export const KEGIATAN_TEMPLATE = [
  "NAMA ANGGOTA YANG IKUT KEGIATAN",
  "",
  "TANGGAL KEGIATAN: 13/11/2026",
  "KEGIATAN        : PENYANDRAAN JAPAPRIDE",
  "NEGOSIASI       : MENANG 1JT UMER",
  "NAMA ANGGOTA    :",
  " 1. RENZO",
  " 2. ROCKY",
].join("\n");

// Label baku. `NAMA ANGGOTA` dicek paling akhir karena paling panjang.
const FIELD_PATTERNS = [
  { key: "date", re: /^TANGGAL\s+KEGIATAN\s*[:=]\s*(.*)$/i },
  { key: "title", re: /^KEGIATAN\s*[:=]\s*(.*)$/i },
  { key: "negotiation", re: /^NEGOSIASI\s*[:=]\s*(.*)$/i },
  { key: "members", re: /^NAMA\s+ANGGOTA\s*[:=]\s*(.*)$/i },
];

const HEADER_RE = /NAMA\s+ANGGOTA\s+YANG\s+IKUT\s+KEGIATAN/i;

/** Tanggal hari ini (WIB) -> YYYY-MM-DD. */
export function todayWib() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** ISO -> DD/MM/YYYY. */
export function fmtDate(iso) {
  const [y, m, d] = String(iso ?? "").slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : "—";
}

function isoOrNull(y, m, d) {
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** "13/11/2026" atau "2026-11-13" -> "2026-11-13" (null kalau tidak valid). */
export function parseDateIso(raw) {
  const text = String(raw ?? "").trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (m) return isoOrNull(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/.exec(text);
  if (m) return isoOrNull(Number(m[3]), Number(m[2]), Number(m[1]));
  return null;
}

function normalizeText(raw) {
  return String(raw ?? "")
    .replace(/\u00a0/g, " ")
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/^\s*>\s?/, "")
        .replace(/```/g, "")
        .replace(/\*\*/g, "")
        .replace(/`/g, "")
        .trim(),
    );
}

function normalizeName(name) {
  return String(name).trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Baca format baku kegiatan dari isi pesan.
 * - { isAttempt: false }                    -> pesan bukan format kegiatan
 * - { isAttempt: true, problems: string[] } -> format dikenali tapi belum valid
 * - { isAttempt: true, data }               -> siap disimpan
 */
export function parseKegiatanText(raw) {
  const text = String(raw ?? "");
  const lines = normalizeText(text);

  const fields = { date: null, title: null, negotiation: null };
  let memberStart = -1;
  let labels = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    for (const { key, re } of FIELD_PATTERNS) {
      const m = re.exec(line);
      if (!m) continue;
      labels += 1;
      if (key === "members") memberStart = i + 1;
      else fields[key] = m[1].trim();
      break;
    }
  }

  const isAttempt = labels >= 2 || HEADER_RE.test(text);
  if (!isAttempt) return { isAttempt: false };

  const participants = [];
  if (memberStart >= 0) {
    for (let i = memberStart; i < lines.length; i++) {
      let line = lines[i];
      if (!line) continue;
      // Label lain menandakan daftar peserta sudah selesai.
      if (FIELD_PATTERNS.some(({ re }) => re.test(line))) break;
      line = line
        .replace(/^\d{1,2}\s*[.)]\s*/, "")
        .replace(/^\d{1,2}\s+/, "")
        .replace(/^[-•*]\s+/, "")
        .trim();
      if (!line) continue;
      participants.push(line);
    }
  }

  const problems = [];

  const title = (fields.title ?? "").replace(/\s+/g, " ").trim();
  if (!title) problems.push("KEGIATAN wajib diisi");
  else if (title.length < 3) problems.push("KEGIATAN minimal 3 karakter");
  else if (title.length > 120) problems.push("KEGIATAN maksimal 120 karakter");

  let negotiation = (fields.negotiation ?? "").replace(/\s+/g, " ").trim();
  if (negotiation === "" || negotiation === "—" || negotiation === "-") negotiation = null;
  else if (negotiation.length > 200) problems.push("NEGOSIASI maksimal 200 karakter");

  let activityDate = fields.date ? parseDateIso(fields.date) : todayWib();
  if (fields.date && !activityDate) {
    problems.push(`TANGGAL KEGIATAN "${fields.date}" tidak valid (contoh 13/11/2026)`);
  }

  if (participants.length === 0) problems.push("NAMA ANGGOTA minimal 1 peserta");
  if (participants.length > MAX_PARTICIPANTS) {
    problems.push(`NAMA ANGGOTA maksimal ${MAX_PARTICIPANTS} peserta`);
  }

  const seen = new Set();
  for (const name of participants) {
    if (name.length < 2) problems.push(`Nama peserta "${name}" minimal 2 karakter`);
    else if (name.length > 60) problems.push(`Nama peserta "${name}" maksimal 60 karakter`);
    const key = normalizeName(name);
    if (seen.has(key)) problems.push(`Peserta "${name}" tercantum lebih dari sekali`);
    seen.add(key);
  }

  if (problems.length) return { isAttempt: true, problems };
  return {
    isAttempt: true,
    data: { title, negotiation, activityDate: activityDate ?? todayWib(), participants },
  };
}
