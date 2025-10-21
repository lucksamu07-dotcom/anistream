import React, { useEffect, useState } from "react";

export default function Player({ url }) {
  const [embedUrl, setEmbedUrl] = useState(null);

  useEffect(() => {
    if (url.includes("streamtape.com")) {
      // Convertir el enlace normal /e/XXXX a embed funcional
      const id = url.split("/e/")[1]?.split("/")[0];
      setEmbedUrl(`https://streamtape.com/e/${id}/`);
    }
  }, [url]);

  return (
    <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black">
      {embedUrl ? (
        <iframe
          src={embedUrl}
          className="w-full h-full border-0"
          allowFullScreen
          allow="autoplay; encrypted-media"
          title="Reproductor de video"
        ></iframe>
      ) : (
        <p className="text-center text-neutral-300 py-10">
          Cargando reproductor...
        </p>
      )}
    </div>
  );
}
