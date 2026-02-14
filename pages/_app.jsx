import "../styles/globals.css";
import Navbar from "../components/Navbar";
import { SessionProvider } from "next-auth/react";
import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

export default function App({ Component, pageProps: { session, ...pageProps } }) {
  const [showBanner, setShowBanner] = useState(true);

  useEffect(() => {
    const handleScroll = () => {
      setShowBanner(window.scrollY <= 80);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <SessionProvider session={session}>
      <div className="min-h-screen flex flex-col bg-neutral-950 text-white relative">
        <AnimatePresence>
          {showBanner && (
            <motion.div
              initial={{ y: -28, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -28, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="fixed top-0 left-0 w-full bg-gradient-to-r from-purple-700 via-pink-600 to-red-500 text-center text-white py-2 font-semibold text-sm shadow-md z-50"
            >
              📢 ¡Subo nuevos animes todos los días! ❤️ Disfruta del mejor contenido actualizado
            </motion.div>
          )}
        </AnimatePresence>

        <div className="pt-10">
          <Navbar />
          <motion.main
            className="flex-1"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Component {...pageProps} />
          </motion.main>
          <motion.footer
            className="border-t border-white/10 bg-black/50 text-center py-4 text-neutral-400 text-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            © {new Date().getFullYear()} AniStream+. Todos los derechos reservados.
          </motion.footer>
        </div>
      </div>
    </SessionProvider>
  );
}
