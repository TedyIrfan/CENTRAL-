"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import type { Activity, ActivityStats, PositionGroup } from "@/lib/types";
import { formatDateId } from "@/lib/dates";
import { ActivityFormModal } from "@/components/kegiatan-form";
import { ActivityDetailModal } from "@/components/kegiatan-detail";
import type { MemberOption } from "@/components/member-picker";
import { Modal } from "@/components/modal";
import {
  Button,
  EmptyState,
  IconButton,
  PageHeader,
  Panel,
  SearchInput,
  Stat,
  StatStrip,
  inputClass,
  tableClass,
  tdClass,
  thClass,
  theadRowClass,
} from "@/components/ui";
import { IconCopy, IconPencil, IconPlus, IconTrash } from "@/components/icons";
import { useToast } from "@/components/toast";

type Meta = { page: number; pageSize: number; total: number; totalPages: number };

export default function KegiatanPage() {
  const toast = useToast();

  const [activities, setActivities] = useState<Activity[]>([]);
  const [meta, setMeta] = useState<Meta>({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const [form, setForm] = useState<{ activity?: Activity } | null>(null);
  const [detail, setDetail] = useState<Activity | null>(null);
  const [deleting, setDeleting] = useState<Activity | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    const qs = new URLSearchParams();
    if (search) qs.set("search", search);
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    qs.set("page", String(page));
    try {
      const [list, st] = await Promise.all([
        api<{ data: Activity[]; meta: Meta }>(`/api/activities?${qs}`),
        api<{ data: ActivityStats }>("/api/activities/stats"),
      ]);
      setActivities(list.data);
      setMeta(list.meta);
      setStats(st.data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, [search, from, to, page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const loadFormData = useCallback(async () => {
    try {
      const [g, s] = await Promise.all([
        api<{ data: PositionGroup[] }>("/api/members/grouped"),
        api<{ data: string[] }>("/api/activities/suggestions"),
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
      // daftar anggota/saran kegiatan tidak wajib; biarkan kosong
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadFormData();
  }, [loadFormData]);

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await api(`/api/activities/${deleting.id}`, { method: "DELETE" });
      toast(`${deleting.code} dihapus`);
      setDeleting(null);
      await Promise.all([load(), loadFormData()]);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Gagal menghapus", "error");
    }
  }

  const filtering = Boolean(search || from || to);

  return (
    <div>
      <PageHeader
        title="Kegiatan"
        description={
          loading ? "Memuat…" : `${meta.total} kegiatan${filtering ? " (terfilter)" : ""}`
        }
        actions={
          <Button variant="primary" onClick={() => setForm({})}>
            <IconPlus /> Catat kegiatan
          </Button>
        }
      />

      <StatStrip cols="grid-cols-2 lg:grid-cols-3">
        <Stat label="Kegiatan bulan ini" value={stats?.kegiatanBulanIni} />
        <Stat label="Peserta bulan ini" value={stats?.pesertaBulanIni} />
        <Stat label="Total kegiatan" value={stats?.total} />
      </StatStrip>

      <div className="mb-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px_150px]">
        <SearchInput
          placeholder="Cari kegiatan, negosiasi, atau nama peserta…"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setPage(1);
          }}
          aria-label="Cari kegiatan"
        />
        <input
          className={inputClass}
          type="date"
          title="Dari tanggal kegiatan"
          aria-label="Dari tanggal kegiatan"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            setPage(1);
          }}
        />
        <input
          className={inputClass}
          type="date"
          title="Sampai tanggal kegiatan"
          aria-label="Sampai tanggal kegiatan"
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {error && (
        <div className="mb-3 flex items-center gap-2 rounded-field border border-bad/25 bg-bad-soft px-3 py-2 text-[12.5px] text-bad">
          {error}
          <button type="button" className="underline" onClick={() => load()}>
            coba lagi
          </button>
        </div>
      )}

      {!loading && !error && activities.length === 0 ? (
        <EmptyState>
          {filtering ? "Tidak ada kegiatan yang cocok." : "Belum ada kegiatan. Klik “Catat kegiatan”."}
        </EmptyState>
      ) : (
        <Panel>
          <div className="overflow-x-auto">
            <table className={`${tableClass} min-w-[860px]`}>
              <thead>
                <tr className={theadRowClass}>
                  <th className={thClass}>Kode</th>
                  <th className={thClass}>Tanggal</th>
                  <th className={thClass}>Kegiatan</th>
                  <th className={thClass}>Negosiasi</th>
                  <th className={thClass}>Peserta</th>
                  <th className={`${thClass} text-right`}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((a) => (
                  <tr key={a.id} className="border-b border-line/60 last:border-0 hover:bg-surface-2/50">
                    <td className={`${tdClass} whitespace-nowrap font-mono text-[11px] text-ink-3`}>
                      {a.code}
                    </td>
                    <td className={`${tdClass} tnum whitespace-nowrap text-ink-2`}>
                      {formatDateId(a.activityDate)}
                    </td>
                    <td className={`${tdClass} font-medium`}>{a.title}</td>
                    <td className={`${tdClass} text-ink-2`}>
                      {a.negotiation ? a.negotiation : <span className="text-ink-3">—</span>}
                    </td>
                    <td className={tdClass}>
                      <div className="tnum text-ink">{a.participants.length} orang</div>
                      <div className="truncate text-[10.5px] text-ink-3">
                        {a.participants
                          .slice(0, 3)
                          .map((p) => p.name)
                          .join(", ")}
                        {a.participants.length > 3 ? ", …" : ""}
                      </div>
                    </td>
                    <td className={`${tdClass} text-right`}>
                      <div className="flex justify-end gap-0.5">
                        <IconButton label="Detail / salin format" onClick={() => setDetail(a)}>
                          <IconCopy size={14} />
                        </IconButton>
                        <IconButton label="Edit" onClick={() => setForm({ activity: a })}>
                          <IconPencil size={14} />
                        </IconButton>
                        <IconButton label="Hapus" tone="danger" onClick={() => setDeleting(a)}>
                          <IconTrash size={14} />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-ink-3">
        <span className="tnum">
          {meta.total} kegiatan{filtering ? " (terfilter)" : ""} · halaman {meta.page} dari{" "}
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
        <ActivityFormModal
          members={members}
          suggestions={suggestions}
          activity={form.activity}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            load();
            loadFormData();
          }}
        />
      )}

      {detail && <ActivityDetailModal activity={detail} onClose={() => setDetail(null)} />}

      {deleting && (
        <Modal title="Hapus kegiatan?" onClose={() => setDeleting(null)}>
          <p className="text-[13px] text-ink-2">
            <b className="text-ink">{deleting.code}</b> — {deleting.title} (
            {deleting.participants.length} peserta) akan dihapus permanen.
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
