import React from "react";

export default function AdSlot({ width = 300, height = 250, zoneId = "XXXXXX", className = "" }) {
  return (
    <div className={`flex items-center justify-center bg-panel rounded-xl shadow-soft ${className}`} style={{ width, height }}>
      {/* Reemplaza el iframe con el script/iframe real de tu red de anuncios (ExoClick, etc.) */}
      <iframe
        title="ad-slot"
        src={`https://ads.example.com/iframe.php?idzone=${zoneId}`}
        width={width}
        height={height}
        frameBorder="0"
        scrolling="no"
      />
    </div>
  );
}
