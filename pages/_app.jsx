import "../styles/globals.css";
import Navbar from "../components/Navbar";

export default function App({ Component, pageProps }) {
  return (
    // Contenedor general con imagen de fondo y efecto glass
    <div className="min-h-screen bg-[url('/fondo.jpg')] bg-cover bg-center bg-fixed">
      {/* Capa translúcida con desenfoque */}
      <div className="backdrop-blur-md bg-black/40 min-h-screen flex flex-col">
        {/* Navbar fija */}
        <Navbar />

        {/* Contenido principal */}
        <main className="flex-1">
          <Component {...pageProps} />
        </main>

        {/* Footer */}
        <footer className="border-t border-white/5 bg-black/10 backdrop-blur-sm">
          <div className="mx-auto max-w-6xl px-4 py-8 text-xs text-neutral-400 text-center">
            © {new Date().getFullYear()} AniStream+. Todos los derechos reservados. · Contenido servido desde terceros.
          </div>
        </footer>
      </div>
    </div>
  );
}
