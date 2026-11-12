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
