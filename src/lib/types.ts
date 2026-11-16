export type MemberStatus = "AKTIF" | "TIDAK_AKTIF" | "DITURUNKAN" | "TIDAK_DIKETAHUI";

export const STATUS_OPTIONS: { value: MemberStatus; label: string; className: string }[] = [
  { value: "AKTIF", label: "Aktif", className: "border-ok/25 bg-ok-soft text-ok" },
  { value: "TIDAK_AKTIF", label: "Tidak Aktif", className: "border-line-2 bg-surface-2 text-ink-3" },
  { value: "DITURUNKAN", label: "Diturunkan", className: "border-bad/25 bg-bad-soft text-bad" },
  { value: "TIDAK_DIKETAHUI", label: "Tidak Diketahui", className: "border-line-2 bg-surface text-ink-2" },
];

export type Position = {
  id: number;
  name: string;
  sortOrder: number;
  memberCount: number;
};

export type GroupMember = {
  id: number;
  name: string;

  hex: string | null;
  discordId: string | null;
  status: MemberStatus;
};

export type PositionGroup = Position & { members: GroupMember[] };

export type WdStatus = "DIPINJAM" | "DIKEMBALIKAN" | "HILANG";

/** Senjata wajib dikembalikan dalam 3 hari kalender sejak tanggal ambil. */
export const WEAPON_DUE_DAYS = 3;

export const WD_STATUS_OPTIONS: { value: WdStatus; label: string; className: string }[] = [
  { value: "DIPINJAM", label: "Dipinjam", className: "border-warn/25 bg-warn-soft text-warn" },
  {
    value: "DIKEMBALIKAN",
    label: "Dikembalikan",
    className: "border-ok/25 bg-ok-soft text-ok",
  },
  { value: "HILANG", label: "Hilang", className: "border-bad/25 bg-bad-soft text-bad" },
];

export type WdRecord = {
  id: number;
  code: string;
  memberId: number | null;
  borrowerName: string;
  itemName: string;
  isWeapon: boolean;
  serialNumber: string | null;
  qty: number;
  durabilityStart: number | null;
  durabilityReturn: number | null;
  takenAt: string;
  dueAt: string | null;
  returnedAt: string | null;
  purpose: string;
  returnNote: string | null;
  lostReason: string | null;
  status: WdStatus;
  discordMessageId: string | null;
  reminderAt: string | null;
  isOverdue: boolean;
  daysLate: number;
  daysLeft: number;
  createdAt: string;
  updatedAt: string;
};

export type WdStats = {
  dipinjam: number;
  kembaliBulanIni: number;
  hilang: number;
  terlambat: number;
  total: number;
};

export type ActivityParticipant = {
  id: number;
  memberId: number | null;
  name: string;
  sortOrder: number;
};

export type Activity = {
  id: number;
  code: string;
  title: string;
  negotiation: string | null;
  activityDate: string;
  discordMessageId: string | null;
  participants: ActivityParticipant[];
  createdAt: string;
  updatedAt: string;
};

export type ActivityStats = {
  kegiatanBulanIni: number;
  pesertaBulanIni: number;
  total: number;
};

export type VaultStatus = "SIAP" | "DIPINJAM" | "HILANG" | "RUSAK";

export const VAULT_STATUS_OPTIONS: { value: VaultStatus; label: string; className: string }[] = [
  { value: "SIAP", label: "Siap", className: "border-ok/25 bg-ok-soft text-ok" },
  { value: "DIPINJAM", label: "Dipinjam", className: "border-warn/25 bg-warn-soft text-warn" },
  { value: "HILANG", label: "Hilang", className: "border-bad/25 bg-bad-soft text-bad" },
  { value: "RUSAK", label: "Rusak", className: "border-line-2 bg-surface-2 text-ink-3" },
];

export type VaultItem = {
  id: number;
  name: string;
  serialNumber: string | null;
  isWeapon: boolean;
  durability: number | null;
  status: VaultStatus;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VaultStats = {
  total: number;
  siap: number;
  dipinjam: number;
  hilang: number;
  rusak: number;
};
