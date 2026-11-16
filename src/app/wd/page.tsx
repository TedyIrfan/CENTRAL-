"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { WD_STATUS_OPTIONS, type PositionGroup, type WdRecord, type WdStats } from "@/lib/types";
import { formatDateId } from "@/lib/dates";
import { WdFormModal, type MemberOption } from "@/components/wd-form";
import { WdLostModal, WdReturnModal } from "@/components/wd-return";
import { WdDetailModal } from "@/components/wd-detail";
import { Modal } from "@/components/modal";
import {
  Badge,
  Button,
  EmptyState,
  IconButton,
  PageHeader,
  Panel,
  SearchInput,
  Stat,
  StatStrip,
  inputClass,
  selectClass,
  tableClass,
  tdClass,
  thClass,
  theadRowClass,
} from "@/components/ui";
import {
  IconAlert,
  IconCopy,
  IconPencil,
  IconPlus,
  IconTrash,
  IconUndo,
} from "@/components/icons";
import { useToast } from "@/components/toast";

type Meta = { page: number; pageSize: number; total: number; totalPages: number };

export default function WdPage() {
  const toast = useToast();

  const [records, setRecords] = useState<WdRecord[]>([]);
  const [meta, setMeta] = useState<Meta>({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [stats, setStats] = useState<WdStats | null>(null);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [overdue, setOverdue] = useState(false);
  const [page, setPage] = useState(1);

  const [form, setForm] = useState<{ record?: WdRecord } | null>(null);
  const [returning, setReturning] = useState<WdRecord | null>(null);
  const [losing, setLosing] = useState<WdRecord | null>(null);
  const [deleting, setDeleting] = useState<WdRecord | null>(null);
  const [detail, setDetail] = useState<WdRecord | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    const qs = new URLSearchParams();
    if (search) qs.set("search", search);
    if (status) qs.set("status", status);
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    if (overdue) qs.set("overdue", "1");
    qs.set("page", String(page));
    try {
      const [list, st] = await Promise.all([
        api<{ data: WdRecord[]; meta: Meta }>(`/api/wd?${qs}`),
        api<{ data: WdStats }>("/api/wd/stats"),
      ]);
      setRecords(list.data);
      setMeta(list.meta);
      setStats(st.data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, [search, status, from, to, overdue, page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const loadFormData = useCallback(async () => {
    try {
      const [g, s] = await Promise.all([
        api<{ data: PositionGroup[] }>("/api/members/grouped"),
        api<{ data: string[] }>("/api/wd/items"),
      ]);
      setMembers(
        g.data.flatMap((group) =>
          group.members.map((m) => ({
            id: m.id,
            name: m.name,
            position: { name: group.name },
          })),
        ),
      );
      setSuggestions(s.data);
    } catch {
      // daftar anggota/saran barang tidak wajib; biarkan kosong
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadFormData();
  }, [loadFormData]);

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await api(`/api/wd/${deleting.id}`, { method: "DELETE" });
      toast(`${deleting.code} dihapus`);
      setDeleting(null);
      await Promise.all([load(), loadFormData()]);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Gagal menghapus", "error");
    }
  }

  const filtering = Boolean(search || status || from || to || overdue);

  return (
    <div>
      <PageHeader
        title="Withdraw Barang"
        description={
          loading ? "Memuat…" : `${meta.total} transaksi${filtering ? " (terfilter)" : ""}`
        }
        actions={
          <Button variant="primary" onClick={() => setForm({})}>
            <IconPlus /> Ambil barang
          </Button>
        }
      />

      <StatStrip>
        <Stat label="Masih dipinjam" value={stats?.dipinjam} />
        <Stat
          label="Terlambat"
          value={stats?.terlambat}
          tone={stats?.terlambat ? "text-bad" : "text-ink"}
          onClick={() => {
            setOverdue((v) => !v);
            setStatus("");
            setPage(1);
          }}
          active={overdue}
        />
        <Stat label="Kembali bulan ini" value={stats?.kembaliBulanIni} />
        <Stat label="Hilang" value={stats?.hilang} tone={stats?.hilang ? "text-bad" : "text-ink"} />
      </StatStrip>

      <div className="mb-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px_150px_150px]">
        <SearchInput
          placeholder="Cari kode, nama, barang, atau SN…"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setPage(1);
          }}
          aria-label="Cari transaksi"
        />
        <select
          className={selectClass}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setOverdue(false);
            setPage(1);
          }}
          aria-label="Filter status"
        >
          <option value="">Semua status</option>
          {WD_STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <input
          className={inputClass}
          type="date"
          title="Dari tanggal ambil"
          aria-label="Dari tanggal ambil"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            setPage(1);
          }}
        />
        <input
          className={inputClass}
          type="date"
          title="Sampai tanggal ambil"
          aria-label="Sampai tanggal ambil"
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {overdue && (
        <div className="mb-3 flex items-center gap-2 rounded-field border border-bad/25 bg-bad-soft px-3 py-1.5 text-[12px] text-bad">
          <IconAlert size={13} />
          Menampilkan hanya senjata yang terlambat dikembalikan.
          <button
            type="button"
            className="underline"
            onClick={() => {
              setOverdue(false);
              setPage(1);
            }}
          >
            tampilkan semua
          </button>
        </div>
      )}

      {error && (
        <div className="mb-3 flex items-center gap-2 rounded-field border border-bad/25 bg-bad-soft px-3 py-2 text-[12.5px] text-bad">
          {error}
          <button type="button" className="underline" onClick={() => load()}>
            coba lagi
          </button>
        </div>
      )}

      {!loading && !error && records.length === 0 ? (
        <EmptyState>
          {filtering
            ? "Tidak ada transaksi yang cocok."
            : "Belum ada transaksi WD. Klik “Ambil barang”."}
        </EmptyState>
      ) : (
        <Panel>
          <div className="overflow-x-auto">
            <table className={`${tableClass} min-w-[1080px]`}>
              <thead>
                <tr className={theadRowClass}>
                  <th className={thClass}>Kode</th>
                  <th className={thClass}>Peminjam</th>
                  <th className={thClass}>Barang</th>
                  <th className={`${thClass} text-right`}>Qty</th>
                  <th className={thClass}>Durab</th>
                  <th className={thClass}>Ambil</th>
                  <th className={thClass}>Tenggat</th>
                  <th className={thClass}>Kembali</th>
                  <th className={thClass}>Status</th>
                  <th className={`${thClass} text-right`}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => {
                  const s = WD_STATUS_OPTIONS.find((o) => o.value === r.status);
                  const late = r.isOverdue || (r.status === "DIKEMBALIKAN" && r.daysLate > 0);
                  return (
                    <tr
                      key={r.id}
                      className={`border-b border-line/60 last:border-0 ${
                        r.isOverdue ? "bg-warn-soft/50" : "hover:bg-surface-2/50"
                      }`}
                    >
                      <td className={`${tdClass} whitespace-nowrap font-mono text-[11px] text-ink-3`}>
                        {r.code}
                      </td>
                      <td className={`${tdClass} whitespace-nowrap font-medium`}>
                        {r.borrowerName}
                      </td>
                      <td className={tdClass}>
                        <div className="text-ink">{r.itemName}</div>
                        <div className="truncate font-mono text-[10.5px] text-ink-3">
                          {r.isWeapon ? (r.serialNumber ?? "—") : "non-senjata"}
                        </div>
                      </td>
                      <td className={`${tdClass} tnum whitespace-nowrap text-right text-ink-2`}>
                        {r.qty}
                      </td>
                      <td className={`${tdClass} tnum whitespace-nowrap font-mono text-[11px] text-ink-2`}>
                        {durabText(r)}
                      </td>
                      <td className={`${tdClass} tnum whitespace-nowrap text-ink-2`}>
                        {formatDateId(r.takenAt)}
                      </td>
                      <td className={`${tdClass} tnum whitespace-nowrap text-[12px]`}>
                        {r.isWeapon && r.dueAt ? (
                          <div className={late ? "text-bad" : "text-ink-2"}>
                            {formatDateId(r.dueAt)}
                            <div className="text-[10.5px] text-ink-3">
                              {r.status === "DIPINJAM"
                                ? r.isOverdue
                                  ? `terlambat ${r.daysLate} hari`
                                  : r.daysLeft === 0
                                    ? "hari ini"
                                    : `sisa ${r.daysLeft} hari`
                                : r.status === "DIKEMBALIKAN" && r.daysLate > 0
                                  ? `telat ${r.daysLate} hari`
                                  : ""}
                            </div>
                          </div>
                        ) : (
                          <span className="text-ink-3">—</span>
                        )}
                      </td>
                      <td className={`${tdClass} tnum whitespace-nowrap text-ink-2`}>
                        {formatDateId(r.returnedAt)}
                      </td>
                      <td className={tdClass}>
                        <Badge className={s?.className}>{s?.label}</Badge>
                      </td>
                      <td className={`${tdClass} text-right`}>
                        <div className="flex justify-end gap-0.5">
                          <IconButton label="Detail / salin format" onClick={() => setDetail(r)}>
                            <IconCopy size={14} />
                          </IconButton>
                          {r.status === "DIPINJAM" && (
                            <>
                              <IconButton label="Kembalikan" onClick={() => setReturning(r)}>
                                <IconUndo size={14} />
                              </IconButton>
                              <IconButton
                                label="Tandai hilang"
                                tone="danger"
                                onClick={() => setLosing(r)}
                              >
                                <IconAlert size={14} />
                              </IconButton>
                              <IconButton label="Edit" onClick={() => setForm({ record: r })}>
                                <IconPencil size={14} />
                              </IconButton>
                            </>
                          )}
                          <IconButton
                            label="Hapus"
                            tone="danger"
                            onClick={() => setDeleting(r)}
                          >
                            <IconTrash size={14} />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-ink-3">
        <span className="tnum">
          {meta.total} transaksi{filtering ? " (terfilter)" : ""} · halaman {meta.page} dari{" "}
          {meta.totalPages || 1}
        </span>
        <div className="flex gap-2">
          <Button size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Sebelumnya
          </Button>
          <Button
            size="sm"
            disabled={meta.totalPages === 0 || page >= meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Berikutnya
          </Button>
        </div>
      </div>

      {form && (
        <WdFormModal
          members={members}
          suggestions={suggestions}
          record={form.record}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            load();
            loadFormData();
          }}
        />
      )}

      {returning && (
        <WdReturnModal
          record={returning}
          onClose={() => setReturning(null)}
          onSaved={() => {
            setReturning(null);
            load();
          }}
        />
      )}

      {losing && (
        <WdLostModal
          record={losing}
          onClose={() => setLosing(null)}
          onSaved={() => {
            setLosing(null);
            load();
          }}
        />
      )}

      {detail && <WdDetailModal record={detail} onClose={() => setDetail(null)} />}

      {deleting && (
        <Modal title="Hapus transaksi WD?" onClose={() => setDeleting(null)}>
          <p className="text-[13px] text-ink-2">
            <b className="text-ink">{deleting.code}</b> — {deleting.borrowerName} (
            {deleting.itemName}) akan dihapus permanen.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button onClick={() => setDeleting(null)}>Batal</Button>
            <Button variant="danger" onClick={confirmDelete}>
              Hapus
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function durabText(r: WdRecord) {
  if (r.durabilityStart === null && r.durabilityReturn === null) return "—";
  const start = r.durabilityStart === null ? "—" : `${r.durabilityStart}%`;
  const end = r.durabilityReturn === null ? "—" : `${r.durabilityReturn}%`;
  return `${start} → ${end}`;
}
