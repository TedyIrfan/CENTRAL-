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
];

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-black/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="Logo Central T"
            width={250}
            height={360}
            unoptimized
            priority
            className="h-12 w-auto"
          />
          <span className="text-lg font-bold tracking-tight">Central T</span>
        </Link>
        <nav className="flex gap-1 overflow-x-auto">
          {links.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
                  active ? "bg-white text-black" : "text-zinc-400 hover:text-white"
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
