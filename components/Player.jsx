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
  if (/hentaistream\./i.test(safeUrl)) return { type: "external_blocked", src: safeUrl };

  if (safeUrl.includes(".m3u8")) return { type: "hls", src: safeUrl };
  if (safeUrl.match(/\.(mp4|webm)(\?|$)/i)) return { type: "file", src: safeUrl };
  if (safeUrl.includes("streamtape.com")) return { type: "iframe", src: toEmbedStreamtape(safeUrl) };
  if (safeUrl.includes("dood.")) return { type: "iframe", src: toEmbedDood(safeUrl) };

  return { type: "iframe", src: safeUrl };
}

function isTouchDevice() {
  return typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);
}

async function lockLandscape() {
  if (!isTouchDevice() || !screen.orientation?.lock) return;
  try {
    await screen.orientation.lock("landscape");
  } catch {
    // browser may block orientation lock
  }
}

function unlockOrientation() {
  if (!screen.orientation?.unlock) return;
  try {
    screen.orientation.unlock();
  } catch {
    // ignore unlock errors
  }
}

function getFullscreenElement() {
  return (
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement ||
    null
  );
}

async function requestFullscreenFor(element) {
  if (!element) return;
  if (element.requestFullscreen) return element.requestFullscreen();
  if (element.webkitRequestFullscreen) return element.webkitRequestFullscreen();
  if (element.mozRequestFullScreen) return element.mozRequestFullScreen();
  if (element.msRequestFullscreen) return element.msRequestFullscreen();
}

async function exitFullscreen() {
  if (document.exitFullscreen) return document.exitFullscreen();
  if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
  if (document.mozCancelFullScreen) return document.mozCancelFullScreen();
  if (document.msExitFullscreen) return document.msExitFullscreen();
}

export default function Player({ url, title = "Reproductor" }) {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const source = useMemo(() => detectSource(url), [url]);

  const toggleContainerFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;

    const fullEl = getFullscreenElement();

    try {
      if (!fullEl) {
        await requestFullscreenFor(container);
        await lockLandscape();
      } else if (fullEl === container) {
        await exitFullscreen();
        unlockOrientation();
      }
    } catch {
      // ignore fullscreen keybinding errors
    }
  };

  useEffect(() => {
    if (source.type !== "hls" && source.type !== "file") return undefined;

    let mounted = true;

    const setup = async () => {
      const { default: Hls } = await import("hls.js");

      if (!mounted || !videoRef.current) return;

      const videoEl = videoRef.current;
      videoEl.setAttribute("playsinline", "");

      if (source.type === "hls") {
        if (Hls.isSupported()) {
          hlsRef.current = new Hls();
          hlsRef.current.loadSource(source.src);
          hlsRef.current.attachMedia(videoEl);
        } else if (videoEl.canPlayType("application/vnd.apple.mpegurl")) {
          videoEl.src = source.src;
        }
      } else {
        videoEl.src = source.src;
      }
    };

    setup();

    return () => {
      mounted = false;
      try {
        if (hlsRef.current) {
          hlsRef.current.detachMedia?.();
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
      } catch {
        hlsRef.current = null;
      }

      try {
        if (videoRef.current) {
          videoRef.current.pause?.();
        }
      } catch {
        // ignore cleanup errors
      }
    };
  }, [source.type, source.src]);

  useEffect(() => {
    const onFullscreenChange = () => {
      const hasFullscreen = !!getFullscreenElement();
      if (hasFullscreen) lockLandscape();
      else unlockOrientation();
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onFullscreenChange);

    const videoEl = videoRef.current;
    const onWebkitBegin = () => {
      lockLandscape();
    };
    const onWebkitEnd = () => {
      unlockOrientation();
    };

    videoEl?.addEventListener("webkitbeginfullscreen", onWebkitBegin);
    videoEl?.addEventListener("webkitendfullscreen", onWebkitEnd);

    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
      videoEl?.removeEventListener("webkitbeginfullscreen", onWebkitBegin);
      videoEl?.removeEventListener("webkitendfullscreen", onWebkitEnd);
      unlockOrientation();
    };
  }, [source.type, source.src]);

  useEffect(() => {
    const onKeyDown = async (event) => {
      const target = event.target;
      const tag = target?.tagName?.toLowerCase();
      const isEditable =
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        target?.isContentEditable;
      if (isEditable) return;

      const key = String(event.key || "").toLowerCase();

      if (key === "f") {
        event.preventDefault();
        await toggleContainerFullscreen();
        return;
      }

      if (source.type === "hls" || source.type === "file") {
        if (key === " " || key === "k") {
          event.preventDefault();
          const videoEl = videoRef.current;
          if (!videoEl) return;
          if (videoEl.paused) await videoEl.play().catch(() => {});
          else videoEl.pause();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [source.type]);

  if (source.type === "unknown") {
    return (
      <div ref={containerRef} className="relative h-full w-full">
        <div className="flex h-full w-full items-center justify-center text-sm text-neutral-300">
          Fuente de video no disponible.
        </div>
      </div>
    );
  }

  if (source.type === "external_blocked") {
    return (
      <div ref={containerRef} className="relative h-full w-full">
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-4 text-center text-sm text-neutral-300">
          <p>Este servidor bloquea la reproduccion embebida.</p>
          <a
            href={source.src}
            target="_blank"
            rel="noreferrer"
            className="rounded bg-pink-600 px-3 py-2 text-white hover:bg-pink-700"
          >
            Abrir servidor en nueva pestana
          </a>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative h-full w-full bg-black">
      {source.type === "iframe" ? (
        <iframe
          src={source.src}
          className="h-full w-full border-0"
          allowFullScreen
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          referrerPolicy="no-referrer-when-downgrade"
          title={title}
        />
      ) : (
        <video
          key={`${source.type}:${source.src}`}
          ref={videoRef}
          className="h-full w-full"
          controls
          title={title}
        />
      )}
    </div>
  );
}
