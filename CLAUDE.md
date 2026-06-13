# Refrito — Guía para Claude

Sitio estático de covers musicales diarios. Cada día se publica una versión de una canción clásica, con texto curatorial propio.

---

## Stack y despliegue

- HTML/CSS/JS vanilla — sin framework, sin bundler
- Alojado en **Netlify**, `publish = "."` (la raíz del repo es el sitio)
- Build command: `node scripts/build.js` (sincroniza propuestas → covers, regenera `_list.json`)
- Node 18 en Netlify
- **Nunca** poner claves en el repo. Variables de entorno en Netlify: `YOUTUBE_API_KEY`, `GITHUB_TOKEN`, `GITHUB_REPO`, `GITHUB_BRANCH`, `GEMINI_API_KEY`

## Estructura de archivos clave

```
index.html          → portada, muestra la pista más reciente publicada
pista.html          → página de detalle de una pista (?fecha=YYYY-MM-DD)
archivo.html        → listado de todas las pistas publicadas
acerca.html         → página sobre el proyecto
logo.svg            → logo: sartén (mango) + vinilo (SVG 76×44)

js/app.js           → lógica de index.html
js/pista.js         → lógica de pista.html
js/archivo.js       → lógica de archivo.html
js/newsletter.js    → suscripción Buttondown (username: "refrito")

css/styles.css      → todos los estilos

content/covers/
  _list.json        → array de fechas publicadas ["YYYY-MM-DD", ...]
  YYYY-MM-DD.json   → datos de cada pista (ver estructura abajo)

content/proposals/  → propuestas con estado "aprobada" → build las promueve a covers

scripts/build.js    → sincroniza proposals → covers, regenera _list.json

netlify/
  functions/
    og-image.js           → genera imagen OG 1080×1080 on-demand (@resvg/resvg-js, node_bundler=nft)
    discovery-background.js → función programada (3am UTC diario)
  edge-functions/
    pista-og.js           → inyecta Open Graph tags dinámicos en /pista.html
```

## Estructura de un cover JSON

```json
{
  "id": "cover-001",
  "youtubeId": "VIDEO_ID",
  "fecha": "2026-06-12",
  "numeroPista": 1,
  "tituloCancion": "Watching the Wheels",
  "interpreteCover": "Lukas Nelson",
  "canalCoverUrl": "https://www.youtube.com/channel/...",
  "artistaOriginal": "John Lennon",
  "videoOriginalUrl": "https://www.youtube.com/watch?v=...",
  "textoCuratorial": "Párrafo 1.\n\nPárrafo 2.",
  "tags": ["john-lennon", "acustico", "intimo"]
}
```

## Reglas de negocio

- **Solo se muestran covers del pasado**: `list.filter(d => d <= today)` en app.js, pista.js y archivo.js
- La portada carga siempre la pista más reciente publicada (`past.at(-1)`)
- `pista.html?fecha=YYYY-MM-DD` → carga esa pista concreta
- Si `fecha` no está en la query string → mensaje de error con enlace a archivo

## Paleta de colores (rotación por fecha)

```js
const PALETTES = [
  { bg: '#EFEAD9', frame: '#EF5226', text: '#16110D', player: '#3D8A60', hi: '#C03C0C' },
  { bg: '#C97A9C', frame: '#16110D', text: '#16110D', player: '#EF5226', hi: '#16110D' },
  { bg: '#7AB897', frame: '#EF5226', text: '#16110D', player: '#C9A04A', hi: '#16110D' },
  { bg: '#C9A04A', frame: '#16110D', text: '#16110D', player: '#3D8A60', hi: '#16110D' },
];
// índice = Math.floor(new Date(iso).getTime() / 86400000) % 4
```
CSS custom properties: `--day-bg`, `--day-frame`, `--day-text`, `--day-hi`, `--verde`

## Navegación prev/next

- Botones `.side-nav` (44×44px, fondo oscuro) dentro de las columnas laterales al player
- Clase `.disabled` (opacity 0.2, pointer-events none) cuando no hay pista anterior/siguiente
- IDs: `#nav-prev`, `#nav-next`
- Rutas limpias: `pista?fecha=YYYY-MM-DD` (sin .html — Netlify hace el rewrite)

## Netlify: redirects y funciones

```toml
[functions]
  directory    = "netlify/functions"
  node_bundler = "nft"          # necesario para @resvg/resvg-js (binario nativo)

# Rutas limpias (status 200 = rewrite, no redirect)
/pista   → /pista.html
/archivo → /archivo.html
/acerca  → /acerca.html

# OG image on-demand
/og-image/:fecha.png → /.netlify/functions/og-image?fecha=:fecha

# Admin
/admin → /admin/index.html
```

Edge function `pista-og` actúa sobre `/pista.html` para inyectar Open Graph tags dinámicos.

## Añadir una nueva semana de pistas

1. Crear `content/covers/YYYY-MM-DD.json` para cada día
2. Ejecutar `node scripts/build.js` → regenera `_list.json`
3. O simplemente hacer commit/push → Netlify ejecuta el build automáticamente

Alternativamente: poner el JSON en `content/proposals/` con `"estado": "aprobada"` y el build lo promueve.

## Gotchas importantes

- **`const` duplicado en funciones**: JS lanza SyntaxError silencioso que bloquea toda la función. Revisar siempre que no haya variables declaradas dos veces en el mismo scope.
- **Servidor local vs Netlify**: servidores tipo `serve` hacen clean-URL redirect `/pista.html` → `/pista` y pierden la query string. En Netlify el redirect es al revés (rewrite 200) y la conserva. Para probar localmente usar directamente `/pista.html?fecha=...`.
- **OG image**: requiere `node_bundler = "nft"` Y `package-lock.json` commiteado para que Netlify incluya el binario nativo de `@resvg/resvg-js`.
- **Logo**: `logo.svg` — sartén (mango hacia arriba-derecha) + vinilo con círculos concéntricos. Colores base: `#EF5226` (naranja) y `#16110D` (casi negro).
- **Newsletter**: Buttondown, username `refrito`. Handler en `js/newsletter.js`, formulario en `index.html` y `acerca.html`.

## Pistas programadas (semana 12–18 jun 2026)

| Fecha      | Nº | Intérprete        | Canción              | Original            |
|------------|----|-------------------|----------------------|---------------------|
| 2026-06-12 | 1  | Lukas Nelson      | Watching the Wheels  | John Lennon         |
| 2026-06-13 | 2  | Brian Castillo    | At the Zoo           | Simon & Garfunkel   |
| 2026-06-14 | 3  | Shields Brothers  | Tumbling Dice        | Rolling Stones      |
| 2026-06-15 | 4  | The Darzis        | Sister Golden Hair   | America             |
| 2026-06-16 | 5  | The Beatles Family| Down South           | Paul McCartney      |
| 2026-06-17 | 6  | Acantha Lang      | The Wind Cries Mary  | Jimi Hendrix        |
| 2026-06-18 | 7  | Mario Morgaño     | Lobo López           | Kiko Veneno         |
