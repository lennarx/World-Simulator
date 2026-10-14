# Simulador de Gobierno Sudamericano

Simulador de gobierno por turnos (1 turno = 1 trimestre, mandato = 16 turnos). Sos presidente/a de un país
de Sudamérica: presupuesto, Congreso, shocks, diplomacia (relaciones, tratados, crisis de frontera) y, en fases
futuras, defensa.
**Todos los valores son ilustrativos.** PWA instalable que funciona offline.

> Para agentes/colaboradores: el detalle completo (arquitectura, estado, roadmap) está en [`CLAUDE.md`](CLAUDE.md).

## Correr

```bash
npm install
npm run dev        # desarrollo en http://localhost:5173
npm test           # tests del motor (Vitest)
npm run sim        # 400 partidas por país × estrategia (6 estrategias), tabla con victorias, crisis y tratados
npm run sim -- 1000          # otra cantidad de partidas
npm run sim:debug            # promedios de indicadores finales por estrategia (para calibrar)
npm run build && npm run preview   # build de producción con service worker (probar PWA/offline)
npm run icons      # regenera íconos PNG desde public/icon.svg
```

## Ajustar el balance (CFG)

Todo número de balance vive en **`src/data/config.ts`** (objeto `CFG`, comentado). Flujo:

1. Cambiá un valor en `CFG` (o en el JSON de un país en `src/data/countries/`).
2. `npm test && npm run sim`.
3. Mirá la tabla: 0 NaN, ninguna estrategia por encima de ~70% de victorias, finales variados por país.

Perillas que más mueven el juego:

| Perilla | Efecto |
|---|---|
| `fiscal.emisionInflacion` | cuánto castiga emitir (populismo con maquinita) |
| `politica.aprobPorPresion`, `presion.porTurno` | desgaste del poder hacia el final |
| `legado.umbralVictoria`, `legado.umbralReeleccion` | qué tan difícil es ganar |
| `finales.juicio*` + `congreso` del país | riesgo de juicio político (clave en Perú) |
| `perfil.rigidez` / `perfil.inercia` / `perfil.tasaBase` del país | lo que hace difícil a Brasil / Argentina |
| `diplomacia.tratados.*` (topes, `relacionMin`) | cuánto rinde firmar tratados |
| `diplomacia.crisis.umbral`, `probPorPunto` | frecuencia de crisis de frontera |

Los datos (países, leyes, eventos, vecinos y relaciones iniciales) están en `src/data/*.json` para reemplazarlos por fuentes públicas sin tocar el motor.

## Deploy (hosting estático con HTTPS)

El build (`dist/`) es estático: sirve cualquier hosting con HTTPS (el service worker **requiere HTTPS**, salvo en `localhost`).

- **Netlify / Vercel / Cloudflare Pages**: comando `npm run build`, carpeta `dist`.
- **GitHub Pages** u otro hosting en un **subpath** (ej. `https://usuario.github.io/World-Simulator/`):
  ```bash
  BASE_PATH=/World-Simulator/ npm run build
  ```
  `BASE_PATH` alimenta la opción `base` de Vite (ver `vite.config.ts`) y con eso también `start_url` y `scope` del
  manifest y el alcance del service worker. Tiene que empezar y terminar con `/`.
- Asegurate de que `sw.js` y `manifest.webmanifest` no queden cacheados agresivamente por el CDN
  (`Cache-Control: no-cache` para esos dos) para que las actualizaciones lleguen; los assets con hash pueden ir con caché larga.

### Verificar la PWA
Chrome DevTools → **Application** → *Manifest* (sin errores, íconos 192/512/maskable) y *Service Workers*
(activo). Probá *Network → Offline* y recargá. En Android aparece el botón **Instalar**; en iOS Safari, un cartel
con "Compartir → Agregar a pantalla de inicio".

## Guardado

Se guarda solo en `localStorage` en cada acción. Además podés **exportar/importar** la partida como JSON
(menú `⋯` en la partida y "Opciones" en el inicio). Si el navegador no permite guardar, la app avisa.
