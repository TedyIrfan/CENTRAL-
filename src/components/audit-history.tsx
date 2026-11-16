"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { Modal } from "@/components/modal";
import { Badge, EmptyState } from "@/components/ui";

type FieldChange = { from: string | null; to: string | null };

type AuditRow = {
  id: number;
  memberId: number | null;
  memberName: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "PROMOTE" | "DEMOTE";
  source: "WEB" | "DISCORD";
  actorId: string | null;
  actorName: string | null;
  changes: Record<string, FieldChange> | null;
  createdAt: string;
};

const ACTION_LABEL: Record<AuditRow["action"], string> = {
  CREATE: "Tambah",
  UPDATE: "Ubah",
  DELETE: "Hapus",
  PROMOTE: "Naik",
  DEMOTE: "Turun",
};

const ACTION_CLASS: Record<AuditRow["action"], string> = {
  CREATE: "border-ok/30 bg-ok-soft text-ok",
  UPDATE: "border-line-2 bg-surface-2 text-ink-2",
  DELETE: "border-bad/25 bg-bad-soft text-bad",
  PROMOTE: "border-ok/30 bg-ok-soft text-ok",
  DEMOTE: "border-warn/30 bg-warn-soft text-warn",
};

const FIELD_LABEL: Record<string, string> = {
  nama: "Nama",
  jabatan: "Jabatan",
  status: "Status",
  hex: "Steam Hex",
  discord: "ID Discord",
};

const STATUS_LABEL: Record<string, string> = {
  AKTIF: "Aktif",
  TIDAK_AKTIF: "Tidak Aktif",
  DITURUNKAN: "Diturunkan",
  TIDAK_DIKETAHUI: "Tidak Diketahui",
};

const timeFormat = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function display(field: string, raw: string | null): string {
  if (raw === null || raw === "") return "—";
  return field === "status" ? (STATUS_LABEL[raw] ?? raw) : raw;
}

/** Riwayat perubahan anggota: dari bot Discord (dengan nama pelaku) atau dari web. */
export function AuditHistory({
  memberId,
  memberName,
  onClose,
}: {
  memberId?: number;
  memberName?: string;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const qs = new URLSearchParams({ pageSize: "60" });
    if (memberId !== undefined) qs.set("memberId", String(memberId));
    api<{ data: AuditRow[] }>(`/api/members/audit?${qs}`)
      .then((res) => setRows(res.data))
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat riwayat"));
  }, [memberId]);

  return (
    <Modal
      title={memberName ? `Riwayat — ${memberName}` : "Riwayat perubahan anggota"}
      onClose={onClose}
      size="lg"
    >
      <p className="mb-3 text-[11.5px] text-ink-3">
        Perubahan lewat bot Discord tercatat dengan nama pelakunya. Perubahan dari web tercatat
        sebagai <b className="font-medium text-ink-2">Web</b> karena halaman ini tanpa login.
      </p>

      {error ? (
        <p className="rounded-field border border-bad/25 bg-bad-soft px-3 py-2 text-[12.5px] text-bad">
          {error}
        </p>
      ) : rows === null ? (
        <p className="py-6 text-center text-[12.5px] text-ink-3">Memuat…</p>
      ) : rows.length === 0 ? (
        <EmptyState>
          Belum ada perubahan tercatat{memberName ? ` untuk ${memberName}` : ""}.
        </EmptyState>
      ) : (
        <ol className="-my-1 max-h-[60vh] divide-y divide-line overflow-y-auto">
          {rows.map((r) => (
            <li key={r.id} className="flex gap-3 py-2.5">
              <span className="tnum w-[86px] shrink-0 pt-0.5 text-[11px] leading-tight text-ink-3">
                {timeFormat.format(new Date(r.createdAt))}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge className={ACTION_CLASS[r.action]}>{ACTION_LABEL[r.action]}</Badge>
                  <span className="truncate text-[12.5px] font-medium text-ink">{r.memberName}</span>
                </div>

                {r.changes && Object.keys(r.changes).length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {Object.entries(r.changes).map(([field, change]) => (
                      <li key={field} className="break-words text-[11.5px] leading-snug text-ink-2">
                        <span className="text-ink-3">{FIELD_LABEL[field] ?? field}:</span>{" "}
                        {display(field, change.from)}{" "}
                        <span aria-hidden="true" className="text-ink-3">
                          →
                        </span>{" "}
                        <span className="font-medium text-ink">{display(field, change.to)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="shrink-0 text-right">
                <Badge
                  className={
                    r.source === "DISCORD"
                      ? "border-ink/20 bg-ink/[0.06] text-ink-2"
                      : "border-line-2 bg-surface-2 text-ink-3"
                  }
                >
                  {r.source === "DISCORD" ? (r.actorName ?? "Discord") : "Web"}
                </Badge>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}
