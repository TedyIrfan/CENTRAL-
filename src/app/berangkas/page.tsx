"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { VAULT_STATUS_OPTIONS, type VaultItem, type VaultStats } from "@/lib/types";
import { VaultFormModal } from "@/components/vault-form";
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
  selectClass,
  tableClass,
  tdClass,
  thClass,
  theadRowClass,
} from "@/components/ui";
import { IconPencil, IconPlus, IconTrash } from "@/components/icons";
import { useToast } from "@/components/toast";

type Meta = { page: number; pageSize: number; total: number; totalPages: number };

export default function BerangkasPage() {
  const toast = useToast();

  const [items, setItems] = useState<VaultItem[]>([]);
  const [meta, setMeta] = useState<Meta>({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [stats, setStats] = useState<VaultStats | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const [form, setForm] = useState<{ item?: VaultItem } | null>(null);
  const [deleting, setDeleting] = useState<VaultItem | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    const qs = new URLSearchParams();
    if (search) qs.set("search", search);
    if (status) qs.set("status", status);
    qs.set("page", String(page));
    try {
      const [list, st] = await Promise.all([
        api<{ data: VaultItem[]; meta: Meta }>(`/api/berangkas?${qs}`),
        api<{ data: VaultStats }>("/api/berangkas/stats"),
      ]);
      setItems(list.data);
      setMeta(list.meta);
      setStats(st.data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, [search, status, page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const loadNames = useCallback(async () => {
    try {
      const res = await api<{ data: string[] }>("/api/berangkas/names");
      setSuggestions(res.data);
    } catch {
      // saran nama tidak wajib
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadNames();
  }, [loadNames]);

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await api(`/api/berangkas/${deleting.id}`, { method: "DELETE" });
      toast(`${deleting.name} dihapus dari Berangkas`);
      setDeleting(null);
      await Promise.all([load(), loadNames()]);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Gagal menghapus", "error");
    }
  }

  const filtering = Boolean(search || status);

  return (
    <div>
      <PageHeader
        title="Berangkas"
        description={loading ? "Memuat…" : `${meta.total} unit${filtering ? " (terfilter)" : ""}`}
        actions={
          <Button variant="primary" onClick={() => setForm({})}>
            <IconPlus /> Barang
          </Button>
        }
      />

      <StatStrip cols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Total unit" value={stats?.total} />
        <Stat label="Siap" value={stats?.siap} tone="text-ok" />
        <Stat label="Dipinjam" value={stats?.dipinjam} tone="text-warn" />
        <Stat label="Hilang" value={stats?.hilang} tone={stats?.hilang ? "text-bad" : "text-ink"} />
        <Stat label="Rusak" value={stats?.rusak} />
      </StatStrip>

      <div className="mb-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_170px]">
        <SearchInput
          placeholder="Cari nama barang, SN, atau catatan…"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setPage(1);
          }}
          aria-label="Cari barang"
        />
        <select
          className={selectClass}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          aria-label="Filter status"
        >
          <option value="">Semua status</option>
          {VAULT_STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mb-3 flex items-center gap-2 rounded-field border border-bad/25 bg-bad-soft px-3 py-2 text-[12.5px] text-bad">
          {error}
          <button type="button" className="underline" onClick={() => load()}>
            coba lagi
          </button>
        </div>
      )}

      {!loading && !error && items.length === 0 ? (
        <EmptyState>
          {filtering
            ? "Tidak ada barang yang cocok."
            : "Berangkas masih kosong. Klik “Barang” untuk mulai mengisi stok."}
        </EmptyState>
      ) : (
        <Panel>
          <div className="overflow-x-auto">
            <table className={`${tableClass} min-w-[720px]`}>
              <thead>
                <tr className={theadRowClass}>
                  <th className={thClass}>Barang</th>
                  <th className={thClass}>SN</th>
                  <th className={`${thClass} text-right`}>Durab</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass}>Catatan</th>
                  <th className={`${thClass} text-right`}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const s = VAULT_STATUS_OPTIONS.find((o) => o.value === it.status);
                  return (
                    <tr key={it.id} className="border-b border-line/60 last:border-0 hover:bg-surface-2/50">
                      <td className={tdClass}>
                        <div className="font-medium text-ink">{it.name}</div>
                        <div className="text-[10.5px] text-ink-3">
                          {it.isWeapon ? "senjata" : "barang"}
                        </div>
                      </td>
                      <td className={`${tdClass} whitespace-nowrap font-mono text-[11px] text-ink-2`}>
                        {it.serialNumber ?? "—"}
                      </td>
                      <td className={`${tdClass} tnum whitespace-nowrap text-right text-ink-2`}>
                        {it.durability === null ? "—" : `${it.durability}%`}
                      </td>
                      <td className={tdClass}>
                        <Badge className={s?.className}>{s?.label ?? it.status}</Badge>
                      </td>
                      <td
                        className={`${tdClass} max-w-[260px] truncate text-ink-2`}
                        title={it.note ?? ""}
                      >
                        {it.note ?? <span className="text-ink-3">—</span>}
                      </td>
                      <td className={`${tdClass} text-right`}>
                        <div className="flex justify-end gap-0.5">
                          <IconButton label="Edit" onClick={() => setForm({ item: it })}>
                            <IconPencil size={14} />
                          </IconButton>
                          <IconButton label="Hapus" tone="danger" onClick={() => setDeleting(it)}>
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
          {meta.total} unit{filtering ? " (terfilter)" : ""} · halaman {meta.page} dari{" "}
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
        <VaultFormModal
          item={form.item}
          suggestions={suggestions}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            load();
            loadNames();
          }}
        />
      )}

      {deleting && (
        <Modal title="Hapus barang dari Berangkas?" onClose={() => setDeleting(null)}>
          <p className="text-[13px] text-ink-2">
            <b className="text-ink">{deleting.name}</b>
            {deleting.serialNumber ? ` — SN ${deleting.serialNumber}` : ""} akan dihapus permanen.
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
