# AniStream+ (Starter)

Plataforma ligera para **listar y reproducir videos de terceros** (+18 permitido por la red publicitaria que elijas), sin usuarios ni login, con espacios para **publicidad**.

## 🚀 Stack
- Next.js 14 (Pages Router) + React 18
- Tailwind CSS
- ReactPlayer (reproductor)
- Slots de publicidad (iframe/script)

## ▶️ Cómo ejecutar

1) **Instalar dependencias**
```bash
npm install
# o
pnpm install
# o
yarn
```

2) **Correr en desarrollo**
```bash
npm run dev
```

3) Abre **http://localhost:3000**

## 🧩 Personalizar contenido

- Edita `data/videos.json` y agrega tus entradas:
```jsonc
{
  "id": "anime-x-ep1",
  "slug": "anime-x-ep1",
  "title": "Anime X — Episodio 1",
  "thumbnail": "https://dummyimage.com/480x270/1a1a1a/ffffff&text=Anime+X+E01",
  "category": "Ecchi",
  "description": "Descripción…",
  "sourceUrl": "https://streamtape.com/v/xxxxx"
}
```
- Miniaturas: pon URLs absolutas o agrega imágenes a `public/images` y usa rutas relativas.  
- Categorías y búsqueda funcionan **en cliente**.

## 💰 Publicidad
- Reemplaza el `<iframe>` en `components/AdSlot.jsx` por el script real de tu red (p.ej. ExoClick).  
- Suele ser algo como:
```html
<script async type="application/javascript" src="https://a.exdynsrv.com/ad-provider.js"></script>
<div id="ad-zone-XXXX"></div>
<script>window.invokeAd && window.invokeAd({zoneId: "XXXX"}); </script>
```
- **Advertencia**: Adsense no acepta +18. Usa redes adultas.

## 🔒 Notas legales y de seguridad
- El sitio **no aloja** contenido; solo **embebe** fuentes de terceros.  
- Incluye páginas de **DMCA** y **Términos** si vas a hacerlo público.  
- Respeta las políticas de la red publicitaria.

## 🧱 Estructura
```
/components   -> Player, Navbar, AdSlot, VideoCard
/data         -> videos.json (catálogo)
/pages        -> index, video/[slug]
/public       -> assets estáticos
/styles       -> Tailwind base
```

## 🛠️ Para producción
- Sube a Vercel o similar.
- Sirve el dominio con HTTPS.
- Considera añadir:
  - Sitemap y metadatos OpenGraph
  - Paginación/infinitescroll
  - Logs de errores (Sentry)
  - SSR para SEO a escala, y caché
