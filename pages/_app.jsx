import "../styles/globals.css";
import Navbar from "../components/Navbar";
import { SessionProvider } from "next-auth/react";
import { useState, useEffect } from "react";

export default function App({ Component, pageProps: { session, ...pageProps } }) {
  const [showBanner, setShowBanner] = useState(true);

  // Efecto para ocultar el banner al hacer scroll
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 80) {
        setShowBanner(false);
      } else {
        setShowBanner(true);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <SessionProvider session={session}>
      <div className="min-h-screen flex flex-col bg-neutral-950 text-white relative">
        {/* 🔔 Banner superior */}
        {showBanner && (
          <div className="fixed top-0 left-0 w-full bg-gradient-to-r from-purple-700 via-pink-600 to-red-500 text-center text-white py-2 font-semibold text-sm shadow-md animate-pulse z-50">
            📢 ¡Subo nuevos animes todos los días! ❤️ Disfruta del mejor contenido actualizado
          </div>
        )}

        {/* Compensar el espacio del banner */}
        <div className="pt-10">
          <Navbar />
          <main className="flex-1">
            <Component {...pageProps} />
          </main>
          <footer className="border-t border-white/10 bg-black/50 text-center py-4 text-neutral-400 text-sm">
            © {new Date().getFullYear()} AniStream+. Todos los derechos reservados.
          </footer>
        </div>
      </div>
    </SessionProvider>
  );
}
