import type { ButtonHTMLAttributes, ReactNode } from "react";
import { STATUS_OPTIONS, type MemberStatus } from "@/lib/types";

export function StatusBadge({ status }: { status: MemberStatus }) {
  const s = STATUS_OPTIONS.find((o) => o.value === status);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${s?.className}`}
    >
      {s?.label ?? status}
    </span>
  );
}

type Variant = "primary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-white text-black hover:bg-zinc-200 font-semibold",
  ghost: "border border-white/10 text-zinc-200 hover:bg-white/10",
  danger: "bg-rose-600 text-white hover:bg-rose-500 font-semibold",
};

export function Button({
  variant = "ghost",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`rounded-lg px-3.5 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${variants[variant]} ${className}`}
    />
  );
}

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
      <span className="mb-1 block text-sm font-medium text-zinc-300">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-rose-400">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-zinc-500">{hint}</span>
      ) : null}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-white/50 focus:outline-none focus:ring-2 focus:ring-white/10";
