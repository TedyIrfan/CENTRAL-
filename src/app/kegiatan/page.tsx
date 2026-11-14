"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import type { Activity, ActivityStats, PositionGroup } from "@/lib/types";
import { formatDateId } from "@/lib/dates";
import { ActivityFormModal } from "@/components/kegiatan-form";
import { ActivityDetailModal } from "@/components/kegiatan-detail";
import type { MemberOption } from "@/components/member-picker";
import { Modal } from "@/components/modal";
import { Button, inputClass } from "@/components/ui";
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
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kegiatan</h1>
          <p className="text-sm text-zinc-500">
            Catatan kegiatan &amp; anggota yang ikut.{" "}
            {loading ? "Memuat…" : `${meta.total} kegiatan.`}
          </p>
        </div>
        <Button variant="primary" onClick={() => setForm({})}>
          + Catat kegiatan
        </Button>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="Kegiatan bulan ini" value={stats?.kegiatanBulanIni} accent="text-sky-300" />
        <StatCard label="Peserta bulan ini" value={stats?.pesertaBulanIni} accent="text-emerald-300" />
        <StatCard label="Total kegiatan" value={stats?.total} accent="text-zinc-100" />
      </div>

      <div className="mb-5 grid gap-2 sm:grid-cols-[1fr_160px_160px]">
        <input
          className={inputClass}
          placeholder="Cari kegiatan, negosiasi, atau nama peserta…"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setPage(1);
          }}
        />
        <input
          className={inputClass}
          type="date"
          title="Dari tanggal kegiatan"
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

      {!loading && !error && activities.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 p-10 text-center text-sm text-zinc-500">
          {filtering ? "Tidak ada kegiatan yang cocok." : "Belum ada kegiatan. Klik “Catat kegiatan”."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-zinc-900/50">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-2.5 font-medium">Kode</th>
                <th className="px-4 py-2.5 font-medium">Tanggal</th>
                <th className="px-4 py-2.5 font-medium">Kegiatan</th>
                <th className="px-4 py-2.5 font-medium">Negosiasi</th>
                <th className="px-4 py-2.5 font-medium">Peserta</th>
                <th className="px-4 py-2.5 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {activities.map((a) => (
                <tr key={a.id} className="hover:bg-white/[0.03]">
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[11px] text-zinc-500">
                    {a.code}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-zinc-400">
                    {formatDateId(a.activityDate)}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-zinc-100">{a.title}</td>
                  <td className="px-4 py-2.5 text-zinc-400">
                    {a.negotiation ? a.negotiation : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="text-zinc-200">{a.participants.length} orang</div>
                    <div className="truncate text-[11px] text-zinc-500">
                      {a.participants.slice(0, 3).map((p) => p.name).join(", ")}
                      {a.participants.length > 3 ? ", …" : ""}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-0.5">
                      <RowBtn label="Detail / salin format" onClick={() => setDetail(a)}>
                        ⧉
                      </RowBtn>
                      <RowBtn label="Edit" onClick={() => setForm({ activity: a })}>
                        ✎
                      </RowBtn>
                      <RowBtn label="Hapus" danger onClick={() => setDeleting(a)}>
                        🗑
                      </RowBtn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
        <span>
          {meta.total} kegiatan
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
          <p className="text-sm text-zinc-300">
            <b>{deleting.code}</b> — {deleting.title} ({deleting.participants.length} peserta) akan
            dihapus permanen.
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
