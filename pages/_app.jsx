import "../styles/globals.css";
import Navbar from "../components/Navbar";
import { useState } from "react";
import AgeGate from "../components/AgeGate";

export default function App({ Component, pageProps }) {
  const [allowed, setAllowed] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      {!allowed && <AgeGate onAccept={() => setAllowed(true)} />}
      {allowed && (
        <>
          <Navbar />
          <main className="flex-1">
            <Component {...pageProps} />
          </main>
          <footer className="border-t border-white/5 bg-surface/80">
            <div className="mx-auto max-w-6xl px-4 py-8 text-xs text-neutral-400">
              © {new Date().getFullYear()} AniStream+. Todos los derechos reservados. ·
              Contenido servido desde terceros.
            </div>
          </footer>
        </>
      )}
    </div>
  );
}
