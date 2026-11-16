"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api-client";
import {
  STATUS_OPTIONS,
  type GroupMember,
  type MemberStatus,
  type PositionGroup,
} from "@/lib/types";
import { MemberForm, type EditingMember } from "@/components/member-form";
import { Modal } from "@/components/modal";
import {
  Badge,
  Button,
  EmptyState,
  IconButton,
  PageHeader,
  Panel,
  SearchInput,
  StatusBadge,
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

const DOT: Record<MemberStatus, string> = {
  AKTIF: "bg-ok",
  TIDAK_AKTIF: "bg-ink-3/60",
  DITURUNKAN: "bg-bad",
  TIDAK_DIKETAHUI: "bg-line-2",
};

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default function StrukturPage() {
  const toast = useToast();

  const [groups, setGroups] = useState<PositionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [showHex, setShowHex] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [flashId, setFlashId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState<FormState>(null);
  const [deleting, setDeleting] = useState<GroupMember | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api<{ data: PositionGroup[] }>("/api/members/grouped");
      setGroups(res.data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const total = useMemo(
    () => groups.reduce((n, g) => n + g.members.length, 0),
    [groups],
  );

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const g of groups) {
      for (const m of g.members) counts[m.status] = (counts[m.status] ?? 0) + 1;
    }
    return counts;
  }, [groups]);

  const selected = useMemo(() => {
    if (selectedId === null) return null;
    for (const g of groups) {
      const member = g.members.find((m) => m.id === selectedId);
      if (member) return { member, position: g };
    }
    return null;
  }, [groups, selectedId]);

  const q = query.trim().toLowerCase();
  const matches = (m: GroupMember) =>
    !q || m.name.toLowerCase().includes(q) || (m.hex ?? "").toLowerCase().includes(q);

  const visibleGroups = groups
    .map((g) => ({ ...g, members: g.members.filter(matches) }))
    .filter((g) => (q ? g.members.length > 0 : true));

  const firstPositionId = groups[0]?.id;
  const lastPositionId = groups[groups.length - 1]?.id;

  async function move(member: GroupMember, dir: "promote" | "demote") {
    setBusy(true);
    try {
      const res = await api<{ data: { position: { name: string } } }>(
        `/api/members/${member.id}/${dir}`,
        { method: "POST" },
      );
      setFlashId(member.id);
      await load();
      toast(
        `${member.name} ${dir === "promote" ? "naik" : "turun"} ke ${res.data.position.name}`,
      );
      setTimeout(() => setFlashId((id) => (id === member.id ? null : id)), 1000);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Gagal", "error");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await api(`/api/members/${deleting.id}`, { method: "DELETE" });
      toast(`${deleting.name} dihapus`);
      if (selectedId === deleting.id) setSelectedId(null);
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
        title="Struktur"
        description={
          loading
            ? "Memuat…"
            : `${total} anggota · ${groups.length} jabatan · dari tertinggi ke terendah`
        }
        actions={
          <>
            <SearchInput
              className="w-full sm:w-56"
              placeholder="Cari nama atau hex…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Cari anggota"
            />
            <Button
              variant={showHex ? "primary" : "secondary"}
              size="md"
              onClick={() => setShowHex((v) => !v)}
              aria-pressed={showHex}
            >
              Hex
            </Button>
            <Button
              variant="primary"
              onClick={() => setForm({})}
              disabled={groups.length === 0}
            >
              <IconPlus /> Anggota
            </Button>
          </>
        }
      />

      {error && (
        <div className="mb-3 flex items-center gap-2 rounded-field border border-bad/25 bg-bad-soft px-3 py-2 text-[12.5px] text-bad">
          {error}
          <button type="button" className="underline" onClick={() => load()}>
            coba lagi
          </button>
        </div>
      )}

      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_296px]">
        <Panel>
          {loading ? (
            <div className="space-y-2 p-3">
              {[0, 1, 2, 3].map((row) => (
                <div key={row} className="flex gap-3">
                  <div className="h-[30px] w-[92px] shrink-0 animate-pulse rounded-field bg-surface-2" />
                  <div className="flex flex-1 gap-1.5">
                    {[0, 1, 2, 3, 4].map((chip) => (
                      <div
                        key={chip}
                        className="h-[30px] w-[160px] animate-pulse rounded-field bg-surface-2"
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : visibleGroups.length === 0 ? (
            <div className="p-4">
              <EmptyState>Tidak ada anggota yang cocok dengan “{query}”.</EmptyState>
            </div>
          ) : (
            visibleGroups.map((g, tier) => (
              <div
                key={g.id}
                className={`flex gap-3 px-3 py-1 ${tier > 0 ? "border-t border-line" : ""}`}
              >
                <div className="w-[92px] shrink-0 pt-1">
                  <div className="text-[10.5px] font-semibold uppercase leading-tight tracking-[0.09em] text-ink-2">
                    {g.name}
                  </div>
                  <div className="tnum text-[10.5px] text-ink-3">{g.members.length} anggota</div>
                </div>

                <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                  {g.members.map((m) => {
                    const isSelected = m.id === selectedId;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedId(isSelected ? null : m.id)}
                        aria-pressed={isSelected}
                        title={`${m.name}${m.hex ? ` · ${m.hex}` : ""}`}
                        className={`group flex w-full items-center gap-1.5 rounded-field border px-1.5 text-left transition-colors sm:w-[160px] ${
                          showHex ? "h-[40px]" : "h-[30px]"
                        } ${
                          isSelected
                            ? "border-ink bg-surface-2"
                            : "border-line bg-surface hover:border-line-2 hover:bg-surface-2/60"
                        } ${flashId === m.id ? "flash-ring" : ""}`}
                      >
                        <span
                          className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[8px] font-bold ${
                            isSelected ? "bg-ink text-white" : "bg-surface-2 text-ink-2"
                          }`}
                        >
                          {initials(m.name)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[11.5px] font-medium leading-tight">
                            {m.name}
                          </span>
                          {showHex && (
                            <span className="block truncate font-mono text-[10px] leading-tight text-ink-3">
                              {m.hex ?? "—"}
                            </span>
                          )}
                          <span className="sr-only">
                            {STATUS_OPTIONS.find((o) => o.value === m.status)?.label}
                          </span>
                        </span>
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[m.status]}`}
                          aria-hidden="true"
                        />
                      </button>
                    );
                  })}

                  {g.members.length === 0 && (
                    <button
                      type="button"
                      onClick={() => setForm({ defaultPositionId: g.id })}
                      className="flex h-[30px] w-full items-center justify-center gap-1 rounded-field border border-dashed border-line-2 text-[11px] text-ink-3 transition-colors hover:border-ink-3 hover:text-ink-2 sm:w-[160px]"
                    >
                      <IconPlus size={12} /> tambah di sini
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </Panel>

        <aside className="lg:sticky lg:top-[68px]">
          <Panel>
            {selected ? (
              <div className="fade-in">
                <div className="flex items-start gap-2.5 border-b border-line p-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-bold text-white">
                    {initials(selected.member.name)}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-semibold leading-tight">
                      {selected.member.name}
                    </div>
                    <div className="mt-1">
                      <StatusBadge status={selected.member.status} />
                    </div>
                  </div>
                </div>

                <dl className="divide-y divide-line text-[12.5px]">
                  <div className="flex items-baseline justify-between gap-3 px-3 py-2">
                    <dt className="text-ink-3">Jabatan</dt>
                    <dd className="text-right font-medium">{selected.position.name}</dd>
                  </div>
                  <div className="px-3 py-2">
                    <dt className="mb-0.5 text-ink-3">Steam Hex</dt>
                    <dd className="flex items-center gap-1">
                      {selected.member.hex ? (
                        <>
                          <code className="min-w-0 flex-1 truncate font-mono text-[11.5px]">
                            {selected.member.hex}
                          </code>
                          <IconButton
                            label="Salin Steam Hex"
                            onClick={() => copy(selected.member.hex!)}
                          >
                            <IconCopy size={13} />
                          </IconButton>
                        </>
                      ) : (
                        <span className="text-ink-3">Belum diisi</span>
                      )}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3 px-3 py-2">
                    <dt className="text-ink-3">ID Discord</dt>
                    <dd className="min-w-0 truncate font-mono text-[11.5px]">
                      {selected.member.discordId ?? <span className="font-sans text-ink-3">—</span>}
                    </dd>
                  </div>
                </dl>

                <div className="grid grid-cols-2 gap-1.5 border-t border-line p-3">
                  <Button
                    size="sm"
                    disabled={busy || selected.position.id === firstPositionId}
                    onClick={() => move(selected.member, "promote")}
                  >
                    <IconArrowUp size={13} /> Naik
                  </Button>
                  <Button
                    size="sm"
                    disabled={busy || selected.position.id === lastPositionId}
                    onClick={() => move(selected.member, "demote")}
                  >
                    <IconArrowDown size={13} /> Turun
                  </Button>
                  <Button
                    size="sm"
                    onClick={() =>
                      setForm({
                        member: { ...selected.member, positionId: selected.position.id },
                      })
                    }
                  >
                    <IconPencil size={13} /> Edit
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => setDeleting(selected.member)}>
                    <IconTrash size={13} /> Hapus
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-3">
                <div className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">
                  Ringkasan
                </div>
                <ul className="space-y-1.5">
                  {STATUS_OPTIONS.map((s) => (
                    <li key={s.value} className="flex items-center justify-between gap-2">
                      <Badge className={s.className}>{s.label}</Badge>
                      <span className="tnum text-[12.5px] font-medium">
                        {statusCounts[s.value] ?? 0}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 border-t border-line pt-2.5 text-[11.5px] leading-relaxed text-ink-3">
                  Klik kartu anggota untuk melihat detail dan mengubah jabatan.
                </p>
              </div>
            )}
          </Panel>
        </aside>
      </div>

      {form && (
        <MemberForm
          positions={groups}
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
