import Link from "next/link";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur bg-surface/70 border-b border-white/5">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-lg font-bold tracking-tight hover:opacity-90">
          <span className="text-white">Ani</span><span className="text-fuchsia-400">Stream+</span>
        </Link>
        <nav className="text-sm text-neutral-300 flex gap-4">
          <Link href="/" className="hover:text-white">Inicio</Link>
          <Link href="/#categorias" className="hover:text-white">Categorías</Link>
          <a href="https://example.com" target="_blank" className="hover:text-white">DMCA</a>
          <a href="/favoritos" className="hover:text-pink-400 transition-colors">❤️ Favoritos</a>
        </nav>
      </div>
    </header>
  );
}
