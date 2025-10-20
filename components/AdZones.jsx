// components/AdZones.jsx
import { useEffect } from "react";

export default function AdZones() {
  useEffect(() => {
    // Ejemplo: ExoClick — reemplaza el zoneid con el tuyo
    const script = document.createElement("script");
    script.src = "https://ads.exoclick.com/tag.php?zoneid=123456"; // 👈 cambia este ID por el tuyo real
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <>
      {/* 🔝 Anuncio superior */}
      <div className="w-full flex justify-center my-4">
        <div
          id="ad-top"
          className="bg-neutral-900 border border-neutral-700 rounded-lg p-2 text-center text-sm text-neutral-400"
        >
          {/* Si querés, podés poner un mensaje temporal mientras carga */}
          <p>Cargando anuncio...</p>
        </div>
      </div>

      {/* 🎞️ Anuncio lateral derecho */}
      <div className="fixed right-2 top-24 w-64 hidden lg:block">
        <div
          id="ad-side"
          className="bg-neutral-900 border border-neutral-700 rounded-lg p-2 text-center text-sm text-neutral-400"
        >
          <p>Publicidad</p>
        </div>
      </div>

      {/* 🔚 Anuncio inferior */}
      <div className="w-full flex justify-center my-6">
        <div
          id="ad-bottom"
          className="bg-neutral-900 border border-neutral-700 rounded-lg p-2 text-center text-sm text-neutral-400"
        >
          <p>Tu anuncio aquí</p>
        </div>
      </div>
    </>
  );
}
