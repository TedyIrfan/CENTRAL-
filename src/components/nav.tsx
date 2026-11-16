"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Struktur" },
  { href: "/anggota", label: "Anggota" },
  { href: "/wd", label: "WD" },
  { href: "/kegiatan", label: "Kegiatan" },
  { href: "/berangkas", label: "Berangkas" },
  { href: "/positions", label: "Jabatan" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur">
      <div className="mx-auto flex h-[52px] max-w-[1400px] items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/logo.png"
            alt="Central T"
            width={250}
            height={360}
            unoptimized
            priority
            className="h-9 w-auto"
          />
          <span className="text-[15px] font-semibold tracking-[-0.01em]">Central T</span>
        </Link>

        <nav aria-label="Navigasi utama" className="flex items-center gap-0.5 overflow-x-auto">
          {links.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap rounded-[6px] px-2.5 py-1.5 text-[13px] transition-colors ${
                  active
                    ? "bg-ink text-white"
                    : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
