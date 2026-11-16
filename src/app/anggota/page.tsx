"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api-client";
import {
  STATUS_OPTIONS,
  type GroupMember,
  type Position,
  type PositionGroup,
} from "@/lib/types";
import { MemberForm, type EditingMember } from "@/components/member-form";
import { Modal } from "@/components/modal";
import {
  Button,
  EmptyState,
  IconButton,
  PageHeader,
  Panel,
  SearchInput,
  StatusBadge,
  inputClass,
  selectClass,
  tableClass,
  tdClass,
  thClass,
  theadRowClass,
} from "@/components/ui";
import {
  IconArrowDown,
  IconArrowUp,
  IconCopy,
  IconPencil,
  IconPlus,
  IconTrash,
} from "@/components/icons";
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

  async function move(member: GroupMember, dir: "promote" | "demote") {
    setBusyId(member.id);
    try {
      const res = await api<{ data: { position: { name: string } } }>(
        `/api/members/${member.id}/${dir}`,
        { method: "POST" },
      );
      toast(`${member.name} ${dir === "promote" ? "naik" : "turun"} ke ${res.data.position.name}`);
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
      <PageHeader
        title="Anggota"
        description={
          loading
            ? "Memuat…"
            : `${total} anggota${filtering || positionId ? " (terfilter)" : ""}`
        }
        actions={
          <Button
            variant="primary"
            onClick={() =>
              setForm({ defaultPositionId: positionId ? Number(positionId) : undefined })
            }
            disabled={positions.length === 0}
          >
            <IconPlus /> Anggota
          </Button>
        }
      />

      <div className="mb-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px_180px]">
        <SearchInput
          placeholder="Cari nama atau Steam Hex…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          aria-label="Cari anggota"
        />
        <select
          className={selectClass}
          value={positionId}
          onChange={(e) => setPositionId(e.target.value)}
          aria-label="Filter jabatan"
        >
          <option value="">Semua jabatan</option>
          {positions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter status"
        >
          <option value="">Semua status</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mb-3 flex items-center gap-2 rounded-field border border-bad/25 bg-bad-soft px-3 py-2 text-[12.5px] text-bad">
          {error}
          <button type="button" className="underline" onClick={load}>
            coba lagi
          </button>
        </div>
      )}

      {!loading && !error && visibleGroups.length === 0 ? (
        <EmptyState>Tidak ada anggota yang cocok.</EmptyState>
      ) : (
        <Panel>
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr className={theadRowClass}>
                  <th className={thClass}>Nama</th>
                  <th className={thClass}>Steam Hex</th>
                  <th className={thClass}>Status</th>
                  <th className={`${thClass} text-right`}>Aksi</th>
                </tr>
              </thead>

              {visibleGroups.map((g) => (
                <tbody key={g.id}>
                  <tr className="border-y border-line bg-surface-2/60 first:border-t-0">
                    <td colSpan={4} className="px-3 py-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-baseline gap-2">
                          <h2 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-ink-2">
                            {g.name}
                          </h2>
                          <span className="tnum text-[11px] text-ink-3">{g.members.length}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setForm({ defaultPositionId: g.id })}
                          className="text-[11.5px] text-ink-3 transition-colors hover:text-ink"
                        >
                          + tambah di sini
                        </button>
                      </div>
                    </td>
                  </tr>

                  {g.members.length === 0 ? (
                    <tr className="border-b border-line/60 last:border-0">
                      <td colSpan={4} className="px-3 py-2.5 text-[12.5px] text-ink-3">
                        Belum ada anggota.
                      </td>
                    </tr>
                  ) : (
                    g.members.map((m) => (
                      <tr
                        key={m.id}
                        className="border-b border-line/60 last:border-0 hover:bg-surface-2/40"
                      >
                        <td className={`${tdClass} font-medium`}>{m.name}</td>
                        <td className={tdClass}>
                          {m.hex ? (
                            <button
                              type="button"
                              onClick={() => copy(m.hex!)}
                              title="Klik untuk menyalin"
                              className="font-mono text-[11.5px] text-ink-2 transition-colors hover:text-ink"
                            >
                              {m.hex}
                            </button>
                          ) : (
                            <span className="text-ink-3">—</span>
                          )}
                        </td>
                        <td className={tdClass}>
                          <StatusBadge status={m.status} />
                        </td>
                        <td className={`${tdClass} text-right`}>
                          <div className="flex justify-end gap-0.5">
                            <IconButton
                              label="Naik jabatan"
                              disabled={busyId === m.id || g.id === firstId}
                              onClick={() => move(m, "promote")}
                            >
                              <IconArrowUp size={14} />
                            </IconButton>
                            <IconButton
                              label="Turun jabatan"
                              disabled={busyId === m.id || g.id === lastId}
                              onClick={() => move(m, "demote")}
                            >
                              <IconArrowDown size={14} />
                            </IconButton>
                            {m.hex && (
                              <IconButton label="Salin Steam Hex" onClick={() => copy(m.hex!)}>
                                <IconCopy size={14} />
                              </IconButton>
                            )}
                            <IconButton
                              label="Edit anggota"
                              onClick={() => setForm({ member: { ...m, positionId: g.id } })}
                            >
                              <IconPencil size={14} />
                            </IconButton>
                            <IconButton
                              label="Hapus anggota"
                              tone="danger"
                              onClick={() => setDeleting(m)}
                            >
                              <IconTrash size={14} />
                            </IconButton>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              ))}
            </table>
          </div>
        </Panel>
      )}

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
          <p className="text-[13px] text-ink-2">
            <b className="text-ink">{deleting.name}</b> akan dihapus permanen. Tindakan ini tidak
            bisa dibatalkan.
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
