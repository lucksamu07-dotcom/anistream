import { useEffect, useState } from "react";
import Link from "next/link";

export default function VideoCard({ video }) {
  const [thumbnail, setThumbnail] = useState(video.thumbnail || "");

  useEffect(() => {
    if (!video.sourceUrl) return;

    let generatedThumbnail = "";

    // 🟣 STREAMTAPE
    if (video.sourceUrl.includes("streamtape")) {
      const id = video.sourceUrl.split("/e/")[1]?.split("/")[0];
      if (id) generatedThumbnail = `https://img.streamtape.to/i/${id}.jpg`;
    }

    // 🔵 DOODSTREAM
    else if (video.sourceUrl.includes("dood")) {
      const id = video.sourceUrl.split("/e/")[1]?.split("/")[0];
      if (id) generatedThumbnail = `https://img.doodcdn.co/splash/${id}.jpg`;
    }

    // 🟢 FILEMOON
    else if (video.sourceUrl.includes("filemoon")) {
      const id = video.sourceUrl.split("/e/")[1]?.split("/")[0];
      if (id) generatedThumbnail = `https://filemoon.sx/asset/userdata/${id}.jpg`;
    }

    // 🟠 MIXDROP
    else if (video.sourceUrl.includes("mixdrop")) {
      const id = video.sourceUrl.split("/f/")[1]?.split("/")[0];
      if (id) generatedThumbnail = `https://i.mixdrop.to/${id}.jpg`;
    }

    // Si no hay imagen generada
    if (!generatedThumbnail) {
      generatedThumbnail =
        "https://i.imgur.com/1lLzQeA.png"; // imagen genérica de respaldo
    }

    setThumbnail(generatedThumbnail);
  }, [video]);

  return (
    <Link href={`/video/${video.slug}`}>
      <div className="relative bg-neutral-900 rounded-lg overflow-hidden cursor-pointer transform hover:scale-105 transition duration-300">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={video.title}
            className="w-full aspect-video object-cover"
          />
        ) : (
          <div className="w-full aspect-video bg-neutral-800 flex items-center justify-center text-neutral-400 text-sm">
            Generando miniatura...
          </div>
        )}

        <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition duration-300 flex items-center justify-center">
          <span className="text-white font-semibold">{video.title}</span>
        </div>
      </div>
    </Link>
  );
}
