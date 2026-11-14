"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import {
  WD_STATUS_OPTIONS,
  type PositionGroup,
  type WdRecord,
  type WdStats,
} from "@/lib/types";
import { formatDateId } from "@/lib/dates";
import { WdFormModal, type MemberOption } from "@/components/wd-form";
import { WdLostModal, WdReturnModal } from "@/components/wd-return";
import { WdDetailModal } from "@/components/wd-detail";
import { Modal } from "@/components/modal";
import { Button, inputClass } from "@/components/ui";
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
  }, [search, status, from, to, page]);

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

  const filtering = Boolean(search || status || from || to);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Withdraw Barang</h1>
          <p className="text-sm text-zinc-500">
            Pengambilan &amp; pengembalian barang. {loading ? "Memuat…" : `${meta.total} transaksi.`}
          </p>
        </div>
        <Button variant="primary" onClick={() => setForm({})}>
          + Ambil barang
        </Button>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="Masih dipinjam" value={stats?.dipinjam} accent="text-amber-300" />
        <StatCard label="Kembali bulan ini" value={stats?.kembaliBulanIni} accent="text-emerald-300" />
        <StatCard label="Hilang" value={stats?.hilang} accent="text-rose-300" />
      </div>

      <div className="mb-5 grid gap-2 sm:grid-cols-[1fr_160px_160px_160px]">
        <input
          className={inputClass}
          placeholder="Cari kode, nama, barang, atau SN…"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setPage(1);
          }}
        />
        <select
          className={inputClass}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
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
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-950/50 p-4 text-sm text-rose-200">
          {error}{" "}
          <button className="underline" onClick={() => load()}>
            Coba lagi
          </button>
        </div>
      )}

      {!loading && !error && records.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 p-10 text-center text-sm text-zinc-500">
          {filtering ? "Tidak ada transaksi yang cocok." : "Belum ada transaksi WD. Klik “Ambil barang”."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-zinc-900/50">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-2.5 font-medium">Kode</th>
                <th className="px-4 py-2.5 font-medium">Peminjam</th>
                <th className="px-4 py-2.5 font-medium">Barang</th>
                <th className="px-4 py-2.5 font-medium">Qty</th>
                <th className="px-4 py-2.5 font-medium">Durab</th>
                <th className="px-4 py-2.5 font-medium">Ambil</th>
                <th className="px-4 py-2.5 font-medium">Kembali</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {records.map((r) => {
                const s = WD_STATUS_OPTIONS.find((o) => o.value === r.status);
                return (
                  <tr key={r.id} className="hover:bg-white/[0.03]">
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[11px] text-zinc-500">
                      {r.code}
                    </td>
                    <td className="px-4 py-2.5 font-medium">{r.borrowerName}</td>
                    <td className="px-4 py-2.5">
                      <div className="text-zinc-200">{r.itemName}</div>
                      <div className="truncate font-mono text-[11px] text-zinc-500">
                        {r.isWeapon ? (r.serialNumber ?? "—") : "non-senjata"}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-zinc-300">{r.qty} PCS</td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[11px] text-zinc-400">
                      {durabText(r)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-zinc-400">
                      {formatDateId(r.takenAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-zinc-400">
                      {formatDateId(r.returnedAt)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${s?.className}`}
                      >
                        {s?.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-0.5">
                        <RowBtn label="Detail / salin format" onClick={() => setDetail(r)}>
                          ⧉
                        </RowBtn>
                        {r.status === "DIPINJAM" && (
                          <>
                            <RowBtn label="Kembalikan" onClick={() => setReturning(r)}>
                              ↩
                            </RowBtn>
                            <RowBtn label="Tandai hilang" danger onClick={() => setLosing(r)}>
                              ⚠
                            </RowBtn>
                            <RowBtn label="Edit" onClick={() => setForm({ record: r })}>
                              ✎
                            </RowBtn>
                          </>
                        )}
                        <RowBtn label="Hapus" danger onClick={() => setDeleting(r)}>
                          🗑
                        </RowBtn>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
        <span>
          {meta.total} transaksi
          {filtering ? " (terfilter)" : ""} · halaman {meta.page} dari {meta.totalPages || 1}
        </span>
        <div className="flex gap-2">
          <Button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Sebelumnya
          </Button>
          <Button
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
          <p className="text-sm text-zinc-300">
            <b>{deleting.code}</b> — {deleting.borrowerName} ({deleting.itemName}) akan dihapus permanen.
          </p>
          <div className="mt-5 flex justify-end gap-2">
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

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value?: number;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900/50 px-4 py-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${accent}`}>{value ?? "—"}</div>
    </div>
  );
}

function RowBtn({
  label,
  danger,
  ...props
}: {
  label: string;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      {...props}
      title={label}
      aria-label={label}
      className={`flex h-8 w-8 items-center justify-center rounded-md text-sm transition ${
        danger
          ? "text-zinc-400 hover:bg-rose-500/20 hover:text-rose-300"
          : "text-zinc-400 hover:bg-white/10 hover:text-white"
      }`}
    />
  );
}
