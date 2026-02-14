import Link from "next/link";
import { motion } from "framer-motion";

const navLinks = [
  { href: "/", label: "Inicio" },
  { href: "/#categorias", label: "Categorías" },
  { href: "https://example.com", label: "DMCA", external: true },
  { href: "/favoritos", label: "❤️ Favoritos", highlight: true },
];

export default function Navbar() {
  return (
    <motion.header
      className="sticky top-0 z-50 w-full backdrop-blur bg-surface/70 border-b border-white/5"
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-lg font-bold tracking-tight hover:opacity-90">
          <motion.span whileHover={{ letterSpacing: 0.5 }} transition={{ duration: 0.2 }}>
            <span className="text-white">Ani</span>
            <span className="text-fuchsia-400">Stream+</span>
          </motion.span>
        </Link>

        <nav className="text-sm text-neutral-300 flex gap-4">
          {navLinks.map((link) => {
            const className = link.highlight
              ? "hover:text-pink-400 transition-colors"
              : "hover:text-white transition-colors";

            if (link.external) {
              return (
                <motion.a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className={className}
                  whileHover={{ y: -1 }}
                >
                  {link.label}
                </motion.a>
              );
            }

            return (
              <motion.div key={link.href} whileHover={{ y: -1 }}>
                <Link href={link.href} className={className}>
                  {link.label}
                </Link>
              </motion.div>
            );
          })}
        </nav>
      </div>
    </motion.header>
  );
}
