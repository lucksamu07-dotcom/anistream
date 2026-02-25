import "../styles/globals.css";
import Navbar from "../components/Navbar";
import { SessionProvider } from "next-auth/react";
import { useState, useEffect } from "react";

export default function App({ Component, pageProps: { session, ...pageProps } }) {
  const [showBanner, setShowBanner] = useState(true);

  useEffect(() => {
    const handleScroll = () => setShowBanner(window.scrollY < 80);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <SessionProvider session={session}>
      <div className="relative flex min-h-screen flex-col bg-neutral-950 text-white">
        <div
          className={`fixed left-0 top-0 z-50 w-full bg-gradient-to-r from-rose-700 via-pink-600 to-orange-500 px-3 py-2 text-center text-xs font-semibold text-white shadow-md sm:text-sm interactive ${
            showBanner ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
          }`}
        >
          Nuevos animes todos los dias. Contenido actualizado constantemente.
        </div>

        <div className={`${showBanner ? "pt-10 sm:pt-11" : "pt-0"} interactive`}>
          <Navbar />
          <main className="flex-1 fluid-enter">
            <Component {...pageProps} />
          </main>
          <footer className="border-t border-white/10 bg-black/50 py-4 text-center text-sm text-neutral-400">
            &copy; {new Date().getFullYear()} AniStream+. Todos los derechos reservados.
          </footer>
        </div>
      </div>
    </SessionProvider>
  );
}
