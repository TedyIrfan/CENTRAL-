"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import { STATUS_OPTIONS, type GroupMember, type MemberStatus, type PositionGroup } from "@/lib/types";
import { MemberForm, type EditingMember } from "@/components/member-form";
import { Modal } from "@/components/modal";
import { Button, inputClass } from "@/components/ui";
import { useToast } from "@/components/toast";

type Flash = { id: number; dir: "up" | "down"; to: string };
type FormState = { member?: EditingMember; defaultPositionId?: number } | null;

const DOT: Record<MemberStatus, string> = {
  AKTIF: "bg-emerald-400",
  TIDAK_AKTIF: "bg-zinc-600",
  DITURUNKAN: "bg-rose-400",
  TIDAK_DIKETAHUI: "bg-white ring-1 ring-zinc-500",
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export default function StrukturPage() {
  const toast = useToast();
  const [groups, setGroups] = useState<PositionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [intro, setIntro] = useState(true);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<FormState>(null);
  const [deleting, setDeleting] = useState<GroupMember | null>(null);

  const cardRefs = useRef(new Map<number, HTMLElement>());
  const prevRects = useRef(new Map<number, DOMRect>());
  const movedId = useRef<number | null>(null);

  const load = useCallback(async (animate = false) => {
    try {
      const res = await api<{ data: PositionGroup[] }>("/api/members/grouped");
      if (animate) {
        // Simpan posisi kartu sebelum data baru dirender (FLIP: First).
        cardRefs.current.forEach((el, id) => prevRects.current.set(id, el.getBoundingClientRect()));
      }
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

  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => setIntro(false), 1500);
    return () => clearTimeout(t);
  }, [loading]);

  // FLIP: Last -> Invert -> Play. Kartu meluncur dari posisi lama ke posisi barunya.
  useLayoutEffect(() => {
    if (prevRects.current.size === 0) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    cardRefs.current.forEach((el, id) => {
      const prev = prevRects.current.get(id);
      if (!prev || reduce) return;
      const next = el.getBoundingClientRect();
      const dx = prev.left - next.left;
      const dy = prev.top - next.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;

      const isMoved = id === movedId.current;
      if (isMoved) el.style.zIndex = "30";
      const anim = el.animate(
        isMoved
          ? [
              { transform: `translate(${dx}px, ${dy}px) scale(1)` },
              { transform: `translate(${dx / 2}px, ${dy / 2}px) scale(1.08)`, offset: 0.5 },
              { transform: "translate(0, 0) scale(1)" },
            ]
          : [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }],
        { duration: isMoved ? 900 : 650, easing: "cubic-bezier(0.22, 0.9, 0.25, 1)" },
      );
      anim.onfinish = () => {
        el.style.zIndex = "";
      };
    });
    prevRects.current.clear();
  }, [groups]);

  async function move(m: GroupMember, dir: "promote" | "demote") {
    setBusy(true);
    try {
      const res = await api<{ data: { position: { name: string } } }>(
        `/api/members/${m.id}/${dir}`,
        { method: "POST" },
      );
      const to = res.data.position.name;
      movedId.current = m.id;
      setFlash({ id: m.id, dir: dir === "promote" ? "up" : "down", to });
      await load(true);
      toast(`${m.name} ${dir === "promote" ? "naik" : "turun"} ke ${to}`);
      setTimeout(() => setFlash((f) => (f?.id === m.id ? null : f)), 4200);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Gagal", "error");
    } finally {
      setTimeout(() => setBusy(false), 900);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await api(`/api/members/${deleting.id}`, { method: "DELETE" });
      toast(`${deleting.name} dihapus`);
      setDeleting(null);
      movedId.current = null;
      await load(true);
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

  const q = query.trim().toLowerCase();
  const matches = (m: GroupMember) =>
    !q || m.name.toLowerCase().includes(q) || (m.hex ?? "").toLowerCase().includes(q);
  const total = groups.reduce((n, g) => n + g.members.length, 0);
  const firstId = groups[0]?.id;
  const lastId = groups[groups.length - 1]?.id;
  let cardIndex = 0;

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Struktur Anggota</h1>
          <p className="mt-1 max-w-md text-sm text-zinc-500">
            Hierarki dari jabatan tertinggi sampai terendah.{" "}
            {loading ? "" : `${total} anggota.`} Arahkan kursor ke kartu untuk menaikkan atau
            menurunkan jabatan.
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <input
            className={`${inputClass} sm:w-64`}
            placeholder="Cari nama atau steam hex…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Button
            variant="primary"
            disabled={groups.length === 0}
            onClick={() => setForm({})}
            className="shrink-0"
          >
            + Tambah anggota
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-950/50 p-4 text-sm text-rose-200">
          {error}{" "}
          <button className="underline" onClick={() => load()}>
            Coba lagi
          </button>
        </div>
      )}

      <div className="flex flex-col items-center">
        {groups.map((g, tier) => {
          const hero = tier === 0;
          return (
            <section key={g.id} className="w-full">
              {tier > 0 && (
                <div className="mx-auto h-9 w-px bg-gradient-to-b from-white/5 to-white/40" />
              )}
              <div className="mb-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-white/10" />
                <span className="rounded-full border border-white/10 bg-zinc-950 px-3.5 py-1 text-xs font-bold tracking-widest text-white">
                  {g.name}
                  <span className="ml-2 font-medium text-zinc-500">{g.members.length}</span>
                </span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <div className="flex flex-wrap justify-center gap-3">
                {g.members.length === 0 && (
                  <div className="flex h-[76px] w-full items-center justify-center rounded-xl border border-dashed border-white/10 text-sm text-zinc-600 sm:w-[260px]">
                    Kosong
                  </div>
                )}
                {g.members.map((m) => {
                  const f = flash?.id === m.id ? flash : null;
                  const delay = Math.min(cardIndex++ * 45, 900);
                  return (
                    <div
                      key={m.id}
                      ref={(el) => {
                        if (el) cardRefs.current.set(m.id, el);
                        else cardRefs.current.delete(m.id);
                      }}
                      style={intro ? { animationDelay: `${delay}ms` } : undefined}
                      className={`group relative flex w-full items-center gap-3 rounded-xl border p-3 transition-[opacity,border-color] duration-300 sm:w-[260px] ${
                        hero
                          ? "border-white bg-white text-black"
                          : "border-white/10 bg-zinc-950 hover:border-white/30"
                      } ${matches(m) ? "" : "opacity-20"} ${intro ? "animate-enter" : ""} ${
                        f ? (f.dir === "up" ? "glow-up" : "glow-down") : ""
                      }`}
                    >
                      {f && (
                        <span
                          className={`badge-pop pointer-events-none absolute -top-3 left-3 z-10 rounded-full px-2.5 py-0.5 text-[11px] font-bold shadow-lg ${
                            f.dir === "up" ? "bg-emerald-400 text-black" : "bg-rose-400 text-black"
                          }`}
                        >
                          {f.dir === "up" ? "▲ Naik" : "▼ Turun"} ke {f.to}
                        </span>
                      )}

                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                          hero ? "bg-black text-white" : "bg-white/10 text-zinc-200"
                        }`}
                      >
                        {initials(m.name)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold leading-tight">{m.name}</div>
                        <div
                          className={`mt-0.5 flex items-center gap-1.5 text-xs ${
                            hero ? "text-black/70" : "text-zinc-400"
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${DOT[m.status]}`} />
                          {STATUS_OPTIONS.find((s) => s.value === m.status)?.label}
                        </div>
                        <div
                          className={`truncate font-mono text-[11px] ${
                            hero ? "text-black/55" : "text-zinc-600"
                          }`}
                          title={m.hex ?? undefined}
                        >
                          {m.hex ?? "—"}
                        </div>
                      </div>

                      <div
                        className={`absolute right-2 top-2 flex gap-0.5 rounded-lg p-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100 ${
                          hero ? "bg-black/80" : "bg-zinc-950/90"
                        }`}
                      >
                        <CardBtn
                          label="Naik jabatan"
                          disabled={busy || g.id === firstId}
                          onClick={() => move(m, "promote")}
                        >
                          ▲
                        </CardBtn>
                        <CardBtn
                          label="Turun jabatan"
                          disabled={busy || g.id === lastId}
                          onClick={() => move(m, "demote")}
                        >
                          ▼
                        </CardBtn>
                        <CardBtn
                          label="Edit"
                          onClick={() => setForm({ member: { ...m, positionId: g.id } })}
                        >
                          ✎
                        </CardBtn>
                        {m.hex && (
                          <CardBtn label="Salin Steam Hex" onClick={() => copy(m.hex!)}>
                            ⧉
                          </CardBtn>
                        )}
                        <CardBtn label="Hapus" onClick={() => setDeleting(m)}>
                          🗑
                        </CardBtn>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {form && (
        <MemberForm
          positions={groups}
          member={form.member}
          defaultPositionId={form.defaultPositionId}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            movedId.current = null;
            load(true);
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

function CardBtn({
  label,
  ...props
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      {...props}
      title={label}
      aria-label={label}
      className="flex h-7 w-7 items-center justify-center rounded-md text-xs text-zinc-300 transition hover:bg-white/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-25"
    />
  );
}
