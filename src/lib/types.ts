export type MemberStatus = "AKTIF" | "TIDAK_AKTIF" | "DITURUNKAN" | "TIDAK_DIKETAHUI";

export const STATUS_OPTIONS: { value: MemberStatus; label: string; className: string }[] = [
  { value: "AKTIF", label: "Aktif", className: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30" },
  { value: "TIDAK_AKTIF", label: "Tidak Aktif", className: "bg-zinc-800 text-zinc-400 ring-zinc-600/60" },
  { value: "DITURUNKAN", label: "Diturunkan", className: "bg-rose-500/15 text-rose-300 ring-rose-500/30" },
  { value: "TIDAK_DIKETAHUI", label: "Tidak Diketahui", className: "bg-white/10 text-white ring-white/30" },
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

export const WD_STATUS_OPTIONS: { value: WdStatus; label: string; className: string }[] = [
  {
    value: "DIPINJAM",
    label: "Dipinjam",
    className: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  },
  {
    value: "DIKEMBALIKAN",
    label: "Dikembalikan",
    className: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  },
  { value: "HILANG", label: "Hilang", className: "bg-rose-500/15 text-rose-300 ring-rose-500/30" },
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
  returnedAt: string | null;
  purpose: string;
  returnNote: string | null;
  lostReason: string | null;
  status: WdStatus;
  discordMessageId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WdStats = {
  dipinjam: number;
  kembaliBulanIni: number;
  hilang: number;
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
  participants: ActivityParticipant[];
  createdAt: string;
  updatedAt: string;
};

export type ActivityStats = {
  kegiatanBulanIni: number;
  pesertaBulanIni: number;
  total: number;
};
