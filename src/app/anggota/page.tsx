"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api-client";
import { STATUS_OPTIONS, type GroupMember, type Position, type PositionGroup } from "@/lib/types";
import { MemberForm, type EditingMember } from "@/components/member-form";
import { Modal } from "@/components/modal";
import { Button, StatusBadge, inputClass } from "@/components/ui";
import { useToast } from "@/components/toast";

type FormState = { member?: EditingMember; defaultPositionId?: number } | null;

export default function MembersPage() {
  const toast = useToast();
  const [positions, setPositions] = useState<Position[]>([]);
  const [groups, setGroups] = useState<PositionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [positionId, setPositionId] = useState("");

  const [form, setForm] = useState<FormState>(null);
  const [deleting, setDeleting] = useState<GroupMember | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    const qs = new URLSearchParams();
    if (search) qs.set("search", search);
    if (status) qs.set("status", status);
    if (positionId) qs.set("positionId", positionId);
    try {
      const [g, p] = await Promise.all([
        api<{ data: PositionGroup[] }>(`/api/members/grouped?${qs}`),
        api<{ data: Position[] }>("/api/positions"),
      ]);
      setGroups(g.data);
      setPositions(p.data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, [search, status, positionId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const filtering = Boolean(search || status);
  const visibleGroups = filtering ? groups.filter((g) => g.members.length > 0) : groups;
  const total = useMemo(() => groups.reduce((n, g) => n + g.members.length, 0), [groups]);
  const firstId = positions[0]?.id;
  const lastId = positions[positions.length - 1]?.id;

  async function move(m: GroupMember, dir: "promote" | "demote") {
    setBusyId(m.id);
    try {
      const res = await api<{ data: { position: { name: string } } }>(
        `/api/members/${m.id}/${dir}`,
        { method: "POST" },
      );
      toast(`${m.name} ${dir === "promote" ? "naik" : "turun"} ke ${res.data.position.name}`);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Gagal", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await api(`/api/members/${deleting.id}`, { method: "DELETE" });
      toast(`${deleting.name} dihapus`);
      setDeleting(null);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Gagal menghapus", "error");
    }
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text).then(
      () => toast("Steam Hex disalin"),
      () => toast("Gagal menyalin", "error"),
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Anggota</h1>
          <p className="text-sm text-zinc-500">
            {loading ? "Memuat…" : `${total} anggota${filtering || positionId ? " (terfilter)" : ""}`}
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => setForm({ defaultPositionId: positionId ? Number(positionId) : undefined })}
          disabled={positions.length === 0}
        >
          + Tambah anggota
        </Button>
      </div>

      <div className="mb-6 grid gap-2 sm:grid-cols-[1fr_180px_180px]">
        <input
          className={inputClass}
          placeholder="Cari nama atau steam hex…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <select className={inputClass} value={positionId} onChange={(e) => setPositionId(e.target.value)}>
          <option value="">Semua jabatan</option>
          {positions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Semua status</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-950/50 p-4 text-sm text-rose-200">
          {error}{" "}
          <button className="underline" onClick={load}>
            Coba lagi
          </button>
        </div>
      )}

      {!loading && !error && visibleGroups.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/10 p-10 text-center text-zinc-500">
          Tidak ada anggota yang cocok.
        </div>
      )}

      <div className="space-y-6">
        {visibleGroups.map((g) => (
          <section key={g.id} className="overflow-hidden rounded-xl border border-white/10 bg-zinc-900/50">
            <header className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="flex items-center gap-2.5">
                <h2 className="font-bold tracking-wide text-white">{g.name}</h2>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-zinc-300">
                  {g.members.length}
                </span>
              </div>
              <button
                onClick={() => setForm({ defaultPositionId: g.id })}
                className="text-xs text-zinc-400 hover:text-white"
              >
                + Tambah di sini
              </button>
            </header>

            {g.members.length === 0 ? (
              <p className="px-4 py-5 text-sm text-zinc-600">Belum ada anggota.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-zinc-500">
                      <th className="px-4 py-2 font-medium">Nama</th>
                      <th className="px-4 py-2 font-medium">Steam Hex</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                      <th className="px-4 py-2 text-right font-medium">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {g.members.map((m) => (
                      <tr key={m.id} className="hover:bg-white/[0.03]">
                        <td className="px-4 py-2.5 font-medium">{m.name}</td>

                        <td className="px-4 py-2.5">
                          {m.hex ? (
                            <button
                              onClick={() => copy(m.hex!)}
                              title="Klik untuk menyalin"
                              className="font-mono text-xs text-zinc-300 hover:text-white"
                            >
                              {m.hex}
                            </button>
                          ) : (
                            <span className="text-zinc-600">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={m.status} />
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex justify-end gap-1">
                            <IconBtn
                              label="Naik jabatan"
                              disabled={busyId === m.id || g.id === firstId}
                              onClick={() => move(m, "promote")}
                            >
                              ▲
                            </IconBtn>
                            <IconBtn
                              label="Turun jabatan"
                              disabled={busyId === m.id || g.id === lastId}
                              onClick={() => move(m, "demote")}
                            >
                              ▼
                            </IconBtn>
                            <IconBtn
                              label="Edit"
                              onClick={() => setForm({ member: { ...m, positionId: g.id } })}
                            >
                              ✎
                            </IconBtn>
                            <IconBtn label="Hapus" danger onClick={() => setDeleting(m)}>
                              🗑
                            </IconBtn>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}
      </div>

      {form && (
        <MemberForm
          positions={positions}
          member={form.member}
          defaultPositionId={form.defaultPositionId}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            load();
          }}
        />
      )}

      {deleting && (
        <Modal title="Hapus anggota?" onClose={() => setDeleting(null)}>
          <p className="text-sm text-zinc-300">
            <b>{deleting.name}</b> akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.
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

function IconBtn({
  label,
  danger,
  ...props
}: {
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      {...props}
      title={label}
      aria-label={label}
      className={`flex h-8 w-8 items-center justify-center rounded-md text-sm transition disabled:cursor-not-allowed disabled:opacity-25 ${
        danger
          ? "text-zinc-400 hover:bg-rose-500/20 hover:text-rose-300"
          : "text-zinc-400 hover:bg-white/10 hover:text-white"
      }`}
    />
  );
}
