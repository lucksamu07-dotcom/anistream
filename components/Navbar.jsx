import { useState } from "react";
import Link from "next/link";

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-[#0f0809]/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
        <Link
          href="/"
          className="interactive flex items-end gap-1 text-lg font-bold tracking-tight hover:opacity-90"
          onClick={() => setOpen(false)}
        >
          <span className="title-display text-2xl leading-none text-white">Ani</span>
          <span className="title-display text-2xl leading-none text-rose-400">Stream+</span>
        </Link>

        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="interactive inline-flex items-center justify-center rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-neutral-100 md:hidden"
          aria-expanded={open}
          aria-label="Abrir menu"
        >
          Menu
        </button>

        <nav className="hidden items-center gap-4 text-sm text-neutral-300 md:flex">
          <Link href="/" className="interactive rounded-lg px-3 py-1.5 hover:bg-white/5 hover:text-white">
            Inicio
          </Link>
          <Link href="/#catalogo" className="interactive rounded-lg px-3 py-1.5 hover:bg-white/5 hover:text-white">
            Catalogo
          </Link>
          <Link href="/dmca" className="interactive rounded-lg px-3 py-1.5 hover:bg-white/5 hover:text-white">
            DMCA
          </Link>
          <Link href="/favoritos" className="interactive rounded-lg bg-rose-500/10 px-3 py-1.5 text-rose-300 hover:bg-rose-500/20">
            Favoritos
          </Link>
        </nav>
      </div>

      {open && (
        <nav className="fluid-enter mx-auto flex max-w-7xl flex-col gap-2 px-4 pb-3 text-sm text-neutral-200 md:hidden">
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className="interactive rounded-lg bg-white/5 px-3 py-2 hover:bg-white/10"
          >
            Inicio
          </Link>
          <Link
            href="/#catalogo"
            onClick={() => setOpen(false)}
            className="interactive rounded-lg bg-white/5 px-3 py-2 hover:bg-white/10"
          >
            Catalogo
          </Link>
          <Link
            href="/dmca"
            onClick={() => setOpen(false)}
            className="interactive rounded-lg bg-white/5 px-3 py-2 hover:bg-white/10"
          >
            DMCA
          </Link>
          <Link
            href="/favoritos"
            onClick={() => setOpen(false)}
            className="interactive rounded-lg bg-rose-500/10 px-3 py-2 text-rose-300 hover:bg-rose-500/20"
          >
            Favoritos
          </Link>
        </nav>
      )}
    </header>
  );
}
