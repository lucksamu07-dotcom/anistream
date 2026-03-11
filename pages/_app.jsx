import "../styles/globals.css";
import "plyr/dist/plyr.css";
import Navbar from "../components/Navbar";
import { SessionProvider } from "next-auth/react";
import { useState, useEffect } from "react";

export default function App({ Component, pageProps: { session, ...pageProps } }) {
  const [showBanner, setShowBanner] = useState(true);

  useEffect(() => {
    // Defensive patch: avoid app crash if a third-party player mutates DOM before React unmount.
    const originalRemoveChild = Node.prototype.removeChild;
    Node.prototype.removeChild = function patchedRemoveChild(child) {
      if (child && child.parentNode !== this) return child;
      return originalRemoveChild.call(this, child);
    };

    return () => {
      Node.prototype.removeChild = originalRemoveChild;
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => setShowBanner(window.scrollY < 80);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <SessionProvider session={session}>
      <div className="relative flex min-h-screen flex-col bg-neutral-950 text-white">
        <div
          className={`fixed left-0 top-0 z-50 w-full bg-gradient-to-r from-rose-700/95 via-red-600/95 to-orange-500/95 px-3 py-1.5 text-center text-[11px] font-semibold tracking-wide text-white shadow-md sm:text-xs interactive ${
            showBanner ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
          }`}
        >
          Nuevos estrenos y actualizaciones todos los dias.
        </div>

        <div className={`${showBanner ? "pt-8 sm:pt-9" : "pt-0"} interactive`}>
          <Navbar />
          <main className="flex-1 fluid-enter">
            <Component {...pageProps} />
          </main>
          <footer className="border-t border-white/10 bg-black/40 py-4 text-center text-sm text-neutral-400">
            &copy; {new Date().getFullYear()} AniStream+. Todos los derechos reservados.
          </footer>
        </div>
      </div>
    </SessionProvider>
  );
}
