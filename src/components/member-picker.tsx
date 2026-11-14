"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { inputClass } from "@/components/ui";

export type MemberOption = { id: number; name: string; position: { name: string } };

type Props = {
  members: MemberOption[];
  value: number | "";
  onChange: (id: number | "") => void;
  error?: string;
  autoFocus?: boolean;
};

/** Combobox anggota: bisa diketik untuk mencari nama atau jabatan. */
export function MemberPicker({ members, value, onChange, error, autoFocus }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = members.find((m) => m.id === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.position.name.toLowerCase().includes(q),
    );
  }, [members, query]);

  const activeIndex = filtered.length === 0 ? 0 : Math.min(active, filtered.length - 1);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  function choose(member: MemberOption) {
    onChange(member.id);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }

  function close() {
    setOpen(false);
    setQuery("");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (filtered.length === 0) return;
      setActive(() => {
        const next = e.key === "ArrowDown" ? activeIndex + 1 : activeIndex - 1;
        return (next + filtered.length) % filtered.length;
      });
    } else if (e.key === "Enter") {
      if (!open) return;
      e.preventDefault();
      const member = filtered[activeIndex];
      if (member) choose(member);
    } else if (e.key === "Escape") {
      if (!open) return;
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === "Tab") {
      close();
    }
  }

  const display = open ? query : (selected?.name ?? "");
  const showClear = !open && selected !== null;

  return (
    <div className="block">
      <span className="mb-1 block text-sm font-medium text-zinc-300">Nama anggota</span>
      <div className="relative">
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={open}
          aria-controls="member-picker-list"
          aria-autocomplete="list"
          aria-activedescendant={open && filtered[activeIndex] ? `member-option-${filtered[activeIndex].id}` : undefined}
          className={`${inputClass} pr-9`}
          value={display}
          placeholder={selected ? selected.name : "Cari nama anggota…"}
          autoFocus={autoFocus}
          onChange={(e) => {
            const v = e.target.value;
            setQuery(v);
            setOpen(true);
            setActive(0);
            if (value !== "" && v.trim().toLowerCase() !== selected?.name.toLowerCase()) {
              onChange("");
            }
          }}
          onFocus={() => {
            setOpen(true);
            setQuery("");
            setActive(0);
          }}
          onBlur={close}
          onKeyDown={onKeyDown}
        />
        {showClear ? (
          <button
            type="button"
            aria-label="Kosongkan pilihan anggota"
            title="Kosongkan"
            className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-xs text-zinc-500 transition hover:bg-white/10 hover:text-white"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange("");
              setQuery("");
              inputRef.current?.focus();
            }}
          >
            ✕
          </button>
        ) : (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500">
            ▾
          </span>
        )}

        {open && (
          <ul
            ref={listRef}
            id="member-picker-list"
            role="listbox"
            className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-white/10 bg-zinc-950 py-1 shadow-2xl shadow-black/60"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-zinc-500">Tidak ada anggota yang cocok.</li>
            ) : (
              filtered.map((m, i) => {
                const isSelected = m.id === value;
                return (
                  <li
                    key={m.id}
                    id={`member-option-${m.id}`}
                    role="option"
                    aria-selected={isSelected}
                    className={`relative flex cursor-pointer flex-col gap-0.5 px-3 py-1.5 ${
                      i === activeIndex ? "bg-white/10 text-white" : "text-zinc-300"
                    }`}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(m)}
                  >
                    <span className="truncate pr-5 text-sm">{m.name}</span>
                    <span className="text-[11px] text-zinc-500">{m.position.name}</span>
                    {isSelected && (
                      <span className="absolute right-3 top-2 text-xs text-emerald-400">✓</span>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        )}
      </div>
      {error ? (
        <span className="mt-1 block text-xs text-rose-400">{error}</span>
      ) : (
        <span className="mt-1 block text-xs text-zinc-500">
          Ketik untuk mencari, ↑ ↓ untuk pilih, Enter untuk konfirmasi.
        </span>
      )}
    </div>
  );
}
