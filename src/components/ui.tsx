import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import type { MemberStatus } from "@/lib/types";
import { STATUS_OPTIONS } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Tombol                                                              */
/* ------------------------------------------------------------------ */

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-ink/90",
  secondary: "border border-line-2 bg-surface text-ink hover:bg-surface-2",
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
  danger: "border border-bad/25 bg-bad-soft text-bad hover:bg-bad hover:text-white",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-2.5 text-[12.5px]",
  md: "h-9 px-3.5 text-[13px]",
};

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      {...props}
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-field font-medium transition-colors disabled:pointer-events-none disabled:opacity-40 ${variants[variant]} ${sizes[size]} ${className}`}
    />
  );
}

/** Tombol ikon: label wajib supaya tetap bisa dibaca screen reader. */
export function IconButton({
  label,
  tone = "default",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  tone?: "default" | "danger";
}) {
  return (
    <button
      {...props}
      type={props.type ?? "button"}
      title={label}
      aria-label={label}
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] transition-colors disabled:pointer-events-none disabled:opacity-25 ${
        tone === "danger"
          ? "text-ink-3 hover:bg-bad-soft hover:text-bad"
          : "text-ink-3 hover:bg-surface-2 hover:text-ink"
      } ${className}`}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Form                                                                */
/* ------------------------------------------------------------------ */

export const inputClass =
  "w-full rounded-field border border-line-2 bg-surface px-2.5 py-1.5 text-[13px] text-ink placeholder:text-ink-3 transition-colors hover:border-ink-3/60 focus:border-ink focus:outline-none disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-3";

export const selectClass = `${inputClass} select-chevron cursor-pointer`;

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-medium text-ink-2">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-[11.5px] text-bad">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-[11.5px] text-ink-3">{hint}</span>
      ) : null}
    </label>
  );
}

export function SearchInput({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={`relative ${className}`}>
      <svg
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.6-3.6" />
      </svg>
      <input {...props} type="search" className={`${inputClass} pl-8`} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Badge                                                               */
/* ------------------------------------------------------------------ */

export function Badge({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-[1px] text-[11px] font-medium ${className}`}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: MemberStatus }) {
  const option = STATUS_OPTIONS.find((o) => o.value === status);
  return <Badge className={option?.className}>{option?.label ?? status}</Badge>;
}

/* ------------------------------------------------------------------ */
/* Kerangka halaman                                                    */
/* ------------------------------------------------------------------ */

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[20px] font-semibold leading-tight tracking-[-0.01em]">{title}</h1>
        {description ? <p className="mt-0.5 text-[12.5px] text-ink-3">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-card border border-line bg-surface ${className}`}>
      {children}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-line-2 px-4 py-10 text-center text-[13px] text-ink-3">
      {children}
    </div>
  );
}

/** Deret angka ringkas dengan garis pemisah 1px. */
export function StatStrip({
  children,
  cols = "grid-cols-2 lg:grid-cols-4",
}: {
  children: ReactNode;
  cols?: string;
}) {
  return (
    <div
      className={`mb-4 grid gap-px overflow-hidden rounded-card border border-line bg-line ${cols}`}
    >
      {children}
    </div>
  );
}

export function Stat({
  label,
  value,
  tone = "text-ink",
  onClick,
  active,
}: {
  label: string;
  value?: number | string;
  tone?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const body = (
    <>
      <span className="block text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
        {label}
      </span>
      <span className={`tnum mt-0.5 block text-[19px] font-semibold leading-tight ${tone}`}>
        {value ?? "—"}
      </span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={`bg-surface px-3 py-2.5 text-left transition-colors hover:bg-surface-2 ${
          active ? "ring-1 ring-inset ring-ink" : ""
        }`}
      >
        {body}
      </button>
    );
  }

  return <div className="bg-surface px-3 py-2.5">{body}</div>;
}

/* ------------------------------------------------------------------ */
/* Tabel                                                               */
/* ------------------------------------------------------------------ */

export const tableClass = "w-full border-collapse text-[13px]";
export const theadRowClass = "border-b border-line bg-surface-2/60";
export const thClass =
  "px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3 whitespace-nowrap";
export const tdClass = "px-3 py-2 align-middle";
export const trClass = "border-b border-line/70 last:border-0 hover:bg-surface-2/50";
