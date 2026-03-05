# AniStream+

Proyecto en Next.js para catalogar series y reproducir episodios embebidos desde proveedores externos.

## Ejecutar en local
1. Instala dependencias:
```bash
npm install
```
2. Inicia desarrollo:
```bash
npm run dev
```
3. Abre:
`http://localhost:3000`

## Scripts
- `npm run dev` -> entorno de desarrollo (puerto 3000)
- `npm run build` -> build de produccion
- `npm run start` -> correr build de produccion
- `npm run lint` -> lint

## Estructura
- `pages/` rutas y APIs
- `components/` componentes UI
- `data/videos.json` catalogo de series y episodios
- `styles/` estilos globales
- `public/` archivos estaticos

## Notas
- El contenido de video se embebe desde terceros.
- Si publicas el sitio, define politica legal (DMCA/terminos) y credenciales seguras para admin.
