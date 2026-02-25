import { useState } from "react";
import Link from "next/link";

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/5 bg-neutral-950/75 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link
          href="/"
          className="interactive text-lg font-bold tracking-tight hover:opacity-90"
          onClick={() => setOpen(false)}
        >
          <span className="text-white">Ani</span>
          <span className="text-fuchsia-400">Stream+</span>
        </Link>

        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="interactive inline-flex items-center justify-center rounded-lg border border-white/15 px-3 py-2 text-sm text-neutral-200 md:hidden"
          aria-expanded={open}
          aria-label="Abrir menu"
        >
          Menu
        </button>

        <nav className="hidden items-center gap-4 text-sm text-neutral-300 md:flex">
          <Link href="/" className="interactive hover:text-white">
            Inicio
          </Link>
          <Link href="/#categorias" className="interactive hover:text-white">
            Categorias
          </Link>
          <Link href="/dmca" className="interactive hover:text-white">
            DMCA
          </Link>
          <Link href="/favoritos" className="interactive hover:text-pink-400">
            Favoritos
          </Link>
        </nav>
      </div>

      {open && (
        <nav className="fluid-enter mx-auto flex max-w-6xl flex-col gap-2 px-4 pb-3 text-sm text-neutral-200 md:hidden">
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className="interactive rounded-lg bg-white/5 px-3 py-2"
          >
            Inicio
          </Link>
          <Link
            href="/#categorias"
            onClick={() => setOpen(false)}
            className="interactive rounded-lg bg-white/5 px-3 py-2"
          >
            Categorias
          </Link>
          <Link
            href="/dmca"
            onClick={() => setOpen(false)}
            className="interactive rounded-lg bg-white/5 px-3 py-2"
          >
            DMCA
          </Link>
          <Link
            href="/favoritos"
            onClick={() => setOpen(false)}
            className="interactive rounded-lg bg-white/5 px-3 py-2 text-pink-300"
          >
            Favoritos
          </Link>
        </nav>
      )}
    </header>
  );
}
