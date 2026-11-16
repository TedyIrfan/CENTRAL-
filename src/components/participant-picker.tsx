"use client";

import { useMemo, useRef, useState } from "react";
import type { MemberOption } from "@/components/member-picker";
import { inputClass } from "@/components/ui";
import { IconArrowDown, IconArrowUp, IconPlus, IconX } from "@/components/icons";

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
  const selectedNames = useMemo(() => new Set(value.map((p) => p.name.toLowerCase())), [value]);

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
        <span className="text-[12px] font-medium text-ink-2">Nama anggota</span>
        <span className="tnum text-[11px] text-ink-3">{value.length}/50 peserta</span>
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
            className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-field border border-line bg-surface py-1 shadow-[0_18px_40px_-24px_rgb(20_19_15_/0.45)]"
          >
            {filtered.map((m, i) => (
              <li
                key={m.id}
                role="option"
                aria-selected={i === activeIndex}
                className={`flex cursor-pointer flex-col gap-0.5 px-2.5 py-1.5 ${
                  i === activeIndex ? "bg-surface-2 text-ink" : "text-ink-2"
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(i)}
              >
                <span className="truncate text-[12.5px]">{m.name}</span>
                <span className="text-[10.5px] text-ink-3">{m.position.name}</span>
              </li>
            ))}

            {filtered.length === 0 && !canAddManual && (
              <li className="px-2.5 py-2 text-[12.5px] text-ink-3">
                {query.trim() ? "Tidak ada anggota yang cocok." : "Semua anggota sudah dipilih."}
              </li>
            )}

            {canAddManual && (
              <li
                role="option"
                aria-selected={activeIndex === filtered.length}
                className={`flex cursor-pointer items-center gap-1.5 border-t border-line px-2.5 py-1.5 text-[12.5px] ${
                  activeIndex === filtered.length ? "bg-surface-2 text-ink" : "text-ink-2"
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(filtered.length)}
                onClick={() => choose(filtered.length)}
              >
                <span className="text-ok">
                  <IconPlus size={12} />
                </span>
                <span className="truncate">
                  Tambah <b>“{trimmed}”</b> (non-anggota)
                </span>
              </li>
            )}
          </ul>
        )}
      </div>

      {value.length === 0 ? (
        <p className="mt-1.5 rounded-field border border-dashed border-line-2 px-3 py-2.5 text-center text-[11.5px] text-ink-3">
          Belum ada peserta. Cari anggota atau ketik nama baru di atas.
        </p>
      ) : (
        <ol className="mt-1.5 space-y-1">
          {value.map((p, i) => (
            <li
              key={`${p.memberId ?? "manual"}-${p.name}-${i}`}
              className="flex items-center gap-1.5 rounded-field border border-line bg-surface px-2 py-1"
            >
              <span className="tnum w-5 shrink-0 text-right font-mono text-[10.5px] text-ink-3">
                {i + 1}.
              </span>
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">{p.name}</span>
              {p.memberId === null && (
                <span className="shrink-0 rounded border border-line-2 px-1 text-[9.5px] uppercase tracking-wide text-ink-3">
                  manual
                </span>
              )}
              <button
                type="button"
                aria-label={`Naikkan ${p.name}`}
                title="Naikkan"
                disabled={i === 0}
                onClick={() => move(i, -1)}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[5px] text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-25"
              >
                <IconArrowUp size={11} />
              </button>
              <button
                type="button"
                aria-label={`Turunkan ${p.name}`}
                title="Turunkan"
                disabled={i === value.length - 1}
                onClick={() => move(i, 1)}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[5px] text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-25"
              >
                <IconArrowDown size={11} />
              </button>
              <button
                type="button"
                aria-label={`Hapus ${p.name}`}
                title="Hapus"
                onClick={() => remove(i)}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[5px] text-ink-3 transition-colors hover:bg-bad-soft hover:text-bad"
              >
                <IconX size={11} />
              </button>
            </li>
          ))}
        </ol>
      )}

      {error ? (
        <span className="mt-1 block text-[11.5px] text-bad">{error}</span>
      ) : (
        <span className="mt-1 block text-[11.5px] text-ink-3">
          Ketik untuk mencari anggota, atau tambahkan nama non-anggota. Urutan bisa diubah.
        </span>
      )}
    </div>
  );
}
