import { useEffect, useMemo, useRef } from "react";

function toEmbedStreamtape(url) {
  const match = url.match(/streamtape\.com\/(?:e|v)\/([^/?#]+)/i);
  return match?.[1] ? `https://streamtape.com/e/${match[1]}/` : url;
}

function toEmbedDood(url) {
  const match = url.match(/dood\.[^/]+\/(?:e|d)\/([^/?#]+)/i);
  return match?.[1] ? `https://dood.wf/e/${match[1]}` : url;
}

function detectSource(url) {
  const safeUrl = String(url || "").trim();
  if (!safeUrl) return { type: "unknown", src: "" };

  if (safeUrl.includes(".m3u8")) return { type: "hls", src: safeUrl };
  if (safeUrl.match(/\.(mp4|webm)(\?|$)/i)) return { type: "file", src: safeUrl };
  if (safeUrl.includes("streamtape.com")) return { type: "iframe", src: toEmbedStreamtape(safeUrl) };
  if (safeUrl.includes("dood.")) return { type: "iframe", src: toEmbedDood(safeUrl) };

  return { type: "iframe", src: safeUrl };
}

export default function Player({ url, title = "Reproductor" }) {
  const videoRef = useRef(null);
  const source = useMemo(() => detectSource(url), [url]);

  useEffect(() => {
    if (source.type !== "hls" && source.type !== "file") return undefined;

    let plyrInstance;
    let hlsInstance;
    let mounted = true;

    const setup = async () => {
      const [{ default: Plyr }, { default: Hls }] = await Promise.all([
        import("plyr"),
        import("hls.js"),
      ]);

      if (!mounted || !videoRef.current) return;

      const videoEl = videoRef.current;
      videoEl.setAttribute("playsinline", "");

      if (source.type === "hls") {
        if (Hls.isSupported()) {
          hlsInstance = new Hls();
          hlsInstance.loadSource(source.src);
          hlsInstance.attachMedia(videoEl);
        } else if (videoEl.canPlayType("application/vnd.apple.mpegurl")) {
          videoEl.src = source.src;
        }
      } else {
        videoEl.src = source.src;
      }

      plyrInstance = new Plyr(videoEl, {
        controls: [
          "play-large",
          "restart",
          "rewind",
          "play",
          "fast-forward",
          "progress",
          "current-time",
          "duration",
          "mute",
          "volume",
          "settings",
          "fullscreen",
        ],
      });
    };

    setup();

    return () => {
      mounted = false;
      if (hlsInstance) hlsInstance.destroy();
      if (plyrInstance) plyrInstance.destroy();
    };
  }, [source.type, source.src]);

  if (source.type === "unknown") {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-neutral-300">
        Fuente de video no disponible.
      </div>
    );
  }

  if (source.type === "iframe") {
    return (
      <iframe
        src={source.src}
        className="h-full w-full border-0"
        allowFullScreen
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        referrerPolicy="no-referrer-when-downgrade"
        title={title}
      />
    );
  }

  return (
    <video
      ref={videoRef}
      className="h-full w-full"
      controls
      title={title}
    />
  );
}
