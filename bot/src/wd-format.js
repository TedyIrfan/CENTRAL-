const MAX_QTY = 10000;

export const WD_TEMPLATE = [
  "FORMAT PENGAMBILAN & PENGEMBALIAN BARANG",
  "TGL PENGAMBILAN   : 14/11/2026",
  "TGL PENGEMBALIAN  : -",
  "NAMA              : CT - Nama",
  "JENIS BARANG      : Pistol",
  "SN                : SN-12345",
  "DURAB AWAL        : 100%",
  "DURAB DIKEMBALIKAN: -",
  "QTY               : 1 PCS",
  "KEPERLUAN         : Jaga wilayah",
].join("\n");

const FIELD_PATTERNS = [
  { key: "takenAt", re: /^TGL\s+PENGAMBILAN\s*[:=]\s*(.*)$/i },
  { key: "returnedAt", re: /^TGL\s+PENGEMBALIAN\s*[:=]\s*(.*)$/i },
  { key: "name", re: /^NAMA\s*[:=]\s*(.*)$/i },
  { key: "itemName", re: /^JENIS\s+BARANG\s*[:=]\s*(.*)$/i },
  { key: "serial", re: /^SN\s*[:=]\s*(.*)$/i },
  { key: "durabilityStart", re: /^DURAB\s+AWAL\s*[:=]\s*(.*)$/i },
  { key: "durabilityReturn", re: /^DURAB\s+DIKEMBALIKAN\s*[:=]\s*(.*)$/i },
  { key: "qty", re: /^QTY\s*[:=]\s*(.*)$/i },
  { key: "purpose", re: /^KEPERLUAN\s*[:=]\s*(.*)$/i },
];

const HEADER_RE = /FORMAT\s+PENG(?:AMBILAN|EMBALIAN)/i;
const EMPTY_VALUE = /^[-–—_.]*$/;

/** Tanggal hari ini (WIB) -> YYYY-MM-DD. */
export function todayWib() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function isoOrNull(y, m, d) {
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return null;
  }
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** "14/11/2026" atau "2026-11-14" -> "2026-11-14" (null kalau tidak valid). */
export function parseDateIso(raw) {
  const text = String(raw ?? "").trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (m) return isoOrNull(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/.exec(text);
  if (m) return isoOrNull(Number(m[3]), Number(m[2]), Number(m[1]));
  return null;
}

function normalizeLines(raw) {
  return String(raw ?? "")
    .replace(/\u00a0/g, " ")
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/```/g, "")
        .replace(/\*\*/g, "")
        .replace(/`/g, "")
        .replace(/^\s*>\s?/, "")
        .trim(),
    );
}

function cleanValue(raw) {
  const text = String(raw ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return EMPTY_VALUE.test(text) ? "" : text;
}

function cleanName(raw) {
  return cleanValue(raw).replace(/^CT\s*[-–—]\s*/i, "").trim();
}

function parseNumber(raw) {
  const text = cleanValue(raw).replace(/%/g, "").trim();
  if (!text) return null;
  const m = /^(\d{1,5})/.exec(text);
  return m ? Number(m[1]) : null;
}

/**
 * Baca format WD (pengambilan / pengembalian) dari isi pesan.
 * - { isAttempt: false }                     -> bukan pesan format WD
 * - { isAttempt: true, problems: string[] }  -> dikenali tapi belum valid
 * - { isAttempt: true, data }                -> siap dikirim ke API
 */
export function parseWdText(raw) {
  const text = String(raw ?? "");
  const lines = normalizeLines(text);
  const fields = {};
  let labels = 0;

  for (const line of lines) {
    if (!line) continue;
    for (const { key, re } of FIELD_PATTERNS) {
      const m = re.exec(line);
      if (!m) continue;
      fields[key] = m[1];
      labels += 1;
      break;
    }
  }

  const isAttempt = HEADER_RE.test(text) || labels >= 4;
  if (!isAttempt) return { isAttempt: false };

  const problems = [];

  const name = cleanName(fields.name);
  if (!name) problems.push("NAMA wajib diisi (pilih anggota, contoh `CT - Budi`)");
  else if (name.length < 2) problems.push("NAMA minimal 2 karakter");
  else if (name.length > 100) problems.push("NAMA maksimal 100 karakter");

  const itemName = cleanValue(fields.itemName);
  if (!itemName) problems.push("JENIS BARANG wajib diisi");
  else if (itemName.length < 2) problems.push("JENIS BARANG minimal 2 karakter");
  else if (itemName.length > 100) problems.push("JENIS BARANG maksimal 100 karakter");

  const qty = parseNumber(fields.qty) ?? 1;
  if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
    problems.push(`QTY harus bilangan bulat 1-${MAX_QTY.toLocaleString("id-ID")}`);
  }

  const purpose = cleanValue(fields.purpose);
  if (!purpose) problems.push("KEPERLUAN wajib diisi");
  else if (purpose.length < 3) problems.push("KEPERLUAN minimal 3 karakter");
  else if (purpose.length > 500) problems.push("KEPERLUAN maksimal 500 karakter");

  const serial = cleanValue(fields.serial);
  const durabilityStart = parseNumber(fields.durabilityStart);
  const durabilityReturn = parseNumber(fields.durabilityReturn);
  const isWeapon = Boolean(serial) || durabilityStart !== null;

  if (durabilityStart !== null && (durabilityStart < 0 || durabilityStart > 100)) {
    problems.push("DURAB AWAL harus 0-100");
  }
  if (durabilityReturn !== null && (durabilityReturn < 0 || durabilityReturn > 100)) {
    problems.push("DURAB DIKEMBALIKAN harus 0-100");
  }

  const takenRaw = cleanValue(fields.takenAt);
  const takenAt = takenRaw ? parseDateIso(takenRaw) : todayWib();
  if (takenRaw && !takenAt) problems.push(`TGL PENGAMBILAN "${takenRaw}" tidak valid (contoh 12/11/2026)`);

  const returnedRaw = cleanValue(fields.returnedAt);
  const returnedAt = returnedRaw ? parseDateIso(returnedRaw) : null;
  if (returnedRaw && !returnedAt) problems.push(`TGL PENGEMBALIAN "${returnedRaw}" tidak valid (contoh 14/11/2026)`);
  if (returnedAt && takenAt && returnedAt < takenAt) {
    problems.push("TGL PENGEMBALIAN tidak boleh sebelum TGL PENGAMBILAN");
  }

  const type = returnedAt ? "kembali" : "ambil";

  if (type === "ambil") {
    if (isWeapon && !serial) problems.push("SN wajib diisi untuk senjata");
    if (isWeapon && durabilityStart === null) problems.push("DURAB AWAL wajib diisi untuk senjata");
  } else {
    if (isWeapon && durabilityReturn === null) {
      problems.push("DURAB DIKEMBALIKAN wajib diisi saat senjata dikembalikan");
    }
    if (
      durabilityStart !== null &&
      durabilityReturn !== null &&
      durabilityReturn > durabilityStart
    ) {
      problems.push("DURAB DIKEMBALIKAN tidak boleh lebih besar dari DURAB AWAL");
    }
  }

  if (isWeapon && serial.length > 100) problems.push("SN maksimal 100 karakter");

  if (problems.length) return { isAttempt: true, problems };

  return {
    isAttempt: true,
    data: {
      type,
      memberName: name,
      itemName,
      isWeapon,
      serialNumber: serial || null,
      durabilityStart,
      durabilityReturn,
      qty,
      purpose,
      takenAt,
      returnedAt,
    },
  };
}
