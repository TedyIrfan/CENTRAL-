"use client";

import { useMemo, useRef, useState } from "react";
import type { MemberOption } from "@/components/member-picker";
import { inputClass } from "@/components/ui";

export type ParticipantDraft = { memberId: number | null; name: string };

type Props = {
  members: MemberOption[];
  value: ParticipantDraft[];
  onChange: (value: ParticipantDraft[]) => void;
  error?: string;
};

/** Pemilih peserta: cari anggota, tambah nama manual, atur urutan. */
export function ParticipantPicker({ members, value, onChange, error }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedIds = useMemo(
    () => new Set(value.flatMap((p) => (p.memberId === null ? [] : [p.memberId]))),
    [value],
  );
  const selectedNames = useMemo(
    () => new Set(value.map((p) => p.name.toLowerCase())),
    [value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter(
      (m) =>
        !selectedIds.has(m.id) &&
        (!q || m.name.toLowerCase().includes(q) || m.position.name.toLowerCase().includes(q)),
    );
  }, [members, query, selectedIds]);

  const trimmed = query.trim().replace(/\s+/g, " ");
  const canAddManual =
    trimmed.length >= 2 &&
    !selectedNames.has(trimmed.toLowerCase()) &&
    !members.some((m) => m.name.toLowerCase() === trimmed.toLowerCase());

  const totalOptions = filtered.length + (canAddManual ? 1 : 0);
  const activeIndex = totalOptions === 0 ? 0 : Math.min(active, totalOptions - 1);

  function add(participant: ParticipantDraft) {
    onChange([...value, participant]);
    setQuery("");
    setActive(0);
    inputRef.current?.focus();
  }

  function choose(index: number) {
    if (index < filtered.length) {
      const member = filtered[index];
      if (member) add({ memberId: member.id, name: member.name });
    } else if (canAddManual) {
      add({ memberId: null, name: trimmed });
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (totalOptions === 0) return;
      setActive(() => {
        const next = e.key === "ArrowDown" ? activeIndex + 1 : activeIndex - 1;
        return (next + totalOptions) % totalOptions;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && totalOptions > 0) choose(activeIndex);
      else if (canAddManual) add({ memberId: null, name: trimmed });
    } else if (e.key === "Escape") {
      if (!open) return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      setQuery("");
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-300">Nama anggota</span>
        <span className="text-[11px] text-zinc-500">{value.length}/50 peserta</span>
      </div>

      <div className="relative">
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={open}
          aria-controls="participant-picker-list"
          aria-autocomplete="list"
          className={inputClass}
          value={query}
          placeholder="Cari anggota atau ketik nama baru…"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false);
            setQuery("");
          }}
          onKeyDown={onKeyDown}
        />

        {open && (
          <ul
            ref={listRef}
            id="participant-picker-list"
            role="listbox"
            className="mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-white/10 bg-zinc-950 py-1 shadow-xl"
          >
            {filtered.map((m, i) => (
              <li
                key={m.id}
                role="option"
                aria-selected={i === activeIndex}
                className={`flex cursor-pointer flex-col gap-0.5 px-3 py-1.5 ${
                  i === activeIndex ? "bg-white/10 text-white" : "text-zinc-300"
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(i)}
              >
                <span className="truncate text-sm">{m.name}</span>
                <span className="text-[11px] text-zinc-500">{m.position.name}</span>
              </li>
            ))}

            {filtered.length === 0 && !canAddManual && (
              <li className="px-3 py-2 text-sm text-zinc-500">
                {query.trim() ? "Tidak ada anggota yang cocok." : "Semua anggota sudah dipilih."}
              </li>
            )}

            {canAddManual && (
              <li
                role="option"
                aria-selected={activeIndex === filtered.length}
                className={`flex cursor-pointer items-center gap-2 border-t border-white/5 px-3 py-2 text-sm ${
                  activeIndex === filtered.length
                    ? "bg-white/10 text-white"
                    : "text-zinc-300"
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(filtered.length)}
                onClick={() => choose(filtered.length)}
              >
                <span className="text-emerald-400">+</span>
                <span className="truncate">
                  Tambah <b>“{trimmed}”</b> (non-anggota)
                </span>
              </li>
            )}
          </ul>
        )}
      </div>

      {value.length === 0 ? (
        <p className="mt-2 rounded-lg border border-dashed border-white/10 px-3 py-3 text-center text-xs text-zinc-500">
          Belum ada peserta. Cari anggota atau ketik nama baru di atas.
        </p>
      ) : (
        <ol className="mt-2 space-y-1">
          {value.map((p, i) => (
            <li
              key={`${p.memberId ?? "manual"}-${p.name}-${i}`}
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5"
            >
              <span className="w-6 shrink-0 text-right font-mono text-xs text-zinc-500">{i + 1}.</span>
              <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">{p.name}</span>
              {p.memberId === null && (
                <span className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-500 ring-1 ring-white/10">
                  manual
                </span>
              )}
              <button
                type="button"
                aria-label={`Naikkan ${p.name}`}
                title="Naikkan"
                disabled={i === 0}
                onClick={() => move(i, -1)}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[11px] text-zinc-500 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`Turunkan ${p.name}`}
                title="Turunkan"
                disabled={i === value.length - 1}
                onClick={() => move(i, 1)}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[11px] text-zinc-500 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                aria-label={`Hapus ${p.name}`}
                title="Hapus"
                onClick={() => remove(i)}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[11px] text-zinc-500 transition hover:bg-rose-500/20 hover:text-rose-300"
              >
                ✕
              </button>
            </li>
          ))}
        </ol>
      )}

      {error ? (
        <span className="mt-1 block text-xs text-rose-400">{error}</span>
      ) : (
        <span className="mt-1 block text-xs text-zinc-500">
          Ketik untuk mencari anggota, atau tambahkan nama non-anggota. Urutan bisa diubah.
        </span>
      )}
    </div>
  );
}
