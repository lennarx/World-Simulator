# CLAUDE.md — Simulador de Gobierno Sudamericano

> Documento de traspaso. Si sos un agente nuevo: leé esto entero antes de tocar nada.
> Acá está **qué es el juego, cómo está armado, qué está hecho, qué falta y cómo seguir**.
> Mantenelo actualizado en cada commit (sobre todo la sección "Estado del proyecto").

---

## 1. Visión y tono

- Simulador de gobierno **por turnos**. El jugador es presidente/a de un país de Sudamérica y administra
  presupuesto, política interna (Congreso), y en fases futuras diplomacia y fuerzas armadas.
- **1 turno = 1 trimestre. Mandato = 16 turnos (4 años).**
- **Victoria**: puntaje de *legado* al final del mandato (crecimiento, estabilidad, bienestar, soberanía,
  aprobación) + bonus si hay reelección.
- **Derrotas anticipadas**: crisis de gobernabilidad, colapso económico, golpe, juicio político.
- Origen: prototipo "Simulador Cono Sur" (guerra AR vs CL por turnos, HTML único). De ahí heredamos:
  motor puro, CFG único, RNG con semilla, simulación headless de balance, eventos con condiciones,
  parte por turno con etiquetas, presión creciente que fuerza el final, pantalla final con desglose y
  mensaje irónico.
- **Tono**: humor rioplatense leve. **Nunca** banalizar víctimas (ni en eventos, ni en guerra, ni en catástrofes).
- Dueño del proyecto: dev .NET/React/TS, hispanohablante rioplatense. UI, comentarios y commits en español.
- Roles: el dueño hace de **arquitecto**; el agente implementa. No arrancar una fase nueva sin su OK explícito.

### Reglas de contenido (obligatorias)
1. Todos los valores son **ilustrativos** y la UI lo dice (componente `IllustrativeBadge`). Nunca presentar
   cifras como datos reales actuales.
2. Usar **roles** ("el presidente de Chile", "la ministra de Economía"), **nunca** personas reales ni líderes por nombre.
3. Los 12 países soberanos: Argentina, Bolivia, Brasil, Chile, Colombia, Ecuador, Guyana, Paraguay, Perú,
   Surinam, Uruguay, Venezuela.
4. Los datos viven en archivos (`src/data/**`) para reemplazarlos después por fuentes públicas
   (Banco Mundial, FMI) **sin tocar el motor**.
5. Íconos/arte: originales. Sin banderas, escudos ni símbolos oficiales.

---

## 2. Stack y comandos

- Vite + React 19 + TypeScript (strict) · Zustand · Vitest · vite-plugin-pwa · tsx (para scripts).
- Sin backend. Guardado en `localStorage` (siempre con try/catch) + export/import de JSON.
- Node 22+.

| Comando | Qué hace |
|---|---|
| `npm install` | instala dependencias |
| `npm run dev` | servidor de desarrollo (Vite) |
| `npm test` | tests del motor y del guardado (Vitest) |
| `npm run sim` | simulación headless de balance (400 partidas por país × estrategia) e imprime tabla |
| `npm run sim:debug` | promedios de indicadores finales y componentes del legado por estrategia |
| `npm run build` | typecheck + build de producción (genera service worker y manifest) |
| `npm run preview` | sirve el build (para probar PWA/offline) |
| `npm run icons` | regenera los PNG de íconos desde `public/icon.svg` |

---

## 3. Arquitectura

```
src/
  engine/   ← PURO. Sin React, sin DOM, sin localStorage, sin Math.random. Solo TS.
  data/     ← config.ts (CFG: TODO el balance), countries/*.json, events.json, bills.json, texts.ts
  ui/       ← React + Zustand. Llama al motor, nunca al revés.
  sim/      ← scripts headless (tsx) que juegan cientos de partidas con estrategias fijas.
tests/      ← Vitest (engine/*, save, sim smoke)
public/     ← icon.svg (fuente) + PNG generados para la PWA
```

### Flujo de un turno
```
decisiones (UI o estrategia del sim)
   └─► advanceTurn(state, decisions)            src/engine/turn.ts
         1. budget.applyBudget      → déficit, financiamiento (deuda/emisión), servicio de deuda
         2. congress.resolveBill    → votación probabilística de la ley propuesta (si hay)
         3. economy.stepEconomy     → crecimiento, inflación, desempleo, reservas, deuda/PBI
         4. events.rollEvents       → eventos con condiciones (shocks), efectos inmediatos y temporales
         5. politics.stepPolitics   → aprobación, gobernabilidad, estabilidad social, capacidad militar
         6. pressure.stepPressure   → desgaste acumulado (empuja hacia el final)
         7. endings.checkEnding     → derrota anticipada o fin de mandato (+ legado y reelección)
   ◄── { state: nuevoEstado, report: entradas del parte con etiqueta }
```
- **Determinismo**: el RNG (`src/engine/rng.ts`, mulberry32) vive *dentro* del estado (`state.rng`).
  Misma semilla + mismas decisiones ⇒ misma partida. Hay test que lo garantiza.
- **Inmutabilidad**: el motor nunca muta el estado de entrada; devuelve uno nuevo (structuredClone al inicio del turno).
- **CFG** (`src/data/config.ts`): único lugar con números de balance. Si escribís un número "mágico" en
  `src/engine`, está mal: movelo a CFG. (Excepciones: 0, 1, 100 como límites de escala, y 4 = trimestres/año.)
- **Datos de país** (`src/data/countries/*.json`): indicadores iniciales, presupuesto base, Congreso
  (bloques), multiplicadores de dificultad y de eventos. `playable: false` = aparece como "Próximamente".
- **Guardado** (`src/ui/save.ts`): `{ version, savedAt, state }`. Si cambia la forma del estado, subí
  `SAVE_VERSION` y escribí la migración. Export/import con validación mínima de forma.

### Modelo (Fase 1)
- **Indicadores** (`state.ind`): `crecimiento` (% anual), `inflacion` (% anual), `deuda` (% PBI),
  `reservas` (meses de importaciones), `desempleo` (%), `aprobacion`, `gobernabilidad`, `estabilidad`
  (0–100), y el gancho `capacidadMilitar` (0–100, ver Fase 3).
- **Presupuesto** (% del PBI anual por área): salud, educación, seguridad, defensa, infraestructura,
  asistencia social, energía, servicio de deuda. Más `impuestos` (recaudación % PBI) y `financiamiento`
  del déficit: `deuda` | `emision` | `mixto`.
  - El servicio de deuda tiene un mínimo exigible (intereses). Pagar menos ⇒ atraso ⇒ sube la prima de
    riesgo. Pagar más ⇒ amortiza.
  - Emisión ⇒ inflación (escala por la inercia inflacionaria del país) y pérdida de reservas.
  - Infraestructura/educación/energía empujan crecimiento con **retardo** (stocks acumulados).
  - Salud/asistencia ⇒ aprobación y estabilidad rápido. Seguridad ⇒ estabilidad.
  - Defensa ⇒ `capacidadMilitar` (lento) y reduce riesgo de golpe por malestar militar.
- **Congreso**: bloques con escaños, afinidad (-100..100), disciplina (0..1) y tipo
  (`oficialismo` | `aliado` | `centro` | `opositor` | `regional`). Una ley por turno. Concesiones a bloques
  cuestan gasto extra (one-shot) y suben el voto del bloque; la oposición dura se enoja un poco.
  Votación: cada bloque vota "en bloque" con probabilidad según disciplina; si no, se parte.
- **Eventos** (`src/data/events.json`): condiciones declarativas (`[{var, op, value}]`), peso,
  multiplicadores por país, efectos inmediatos y temporales (`duracion` en turnos).
- **Presión**: crece cada turno y con baja aprobación; erosiona aprobación/gobernabilidad y aumenta la
  chance de eventos negativos.
- **Final**: legado = suma ponderada de 5 componentes (0–100) medidos mayormente como **mejora vs. el
  inicio** (así un país difícil no queda condenado). Reelección si aprobación final + ruido ≥ umbral.

### Dificultad por país (difícil *de forma distinta*)
| País | Problema principal | Cómo se modela |
|---|---|---|
| Argentina | Inflación con inercia, reservas flacas | `inercia` alta, inflación inicial alta, reservas bajas, emisión pega más |
| Perú | Congreso fragmentado y hostil | muchos bloques chicos, afinidad baja, disciplina baja, `riesgoJuicio` alto |
| Brasil | Deuda alta y gasto rígido | deuda/PBI alta, tasa base alta, presupuesto base rígido (cortar duele más) |

---

## 4. Convenciones

- TypeScript strict. Funciones puras en `engine`. Nombres de dominio en español (`inflacion`, `presupuesto`).
- Comentar **por qué** cuando un cálculo de balance no es obvio.
- Cada módulo del motor tiene su test en `tests/engine/`. Bug de balance ⇒ primero test o corrida de sim.
- Después de tocar CFG: `npm test && npm run sim` y mirar la tabla.
- Accesibilidad: todo usable por teclado, `aria-label` en controles sin texto, foco visible, contraste en ambos temas.
- Mobile-first. Tokens CSS en `src/ui/theme.css` (`--color-*`), tema claro/oscuro. Safe-area insets.

### Cómo agregar un evento
1. Agregá un objeto en `src/data/events.json`: `id`, `tag` (ECONOMÍA | SOCIEDAD | CONGRESO | CLIMA | ESCÁNDALO | GOBIERNO | EVENTO), `peso`, `negativo` (la presión lo potencia), `cond`, `efectos` (deltas inmediatos), opcionales `temporal: { efectos, duracion }` (delta por turno), `commodity: true` (escala con `perfil.sensibilidadCommodities`), `escandalo: true` (activa escándalo ⇒ habilita juicio político), `prima` (pp), y `texto`.
2. Variables válidas para `cond` (`[{var, op: '<'|'>'|'<='|'>=', value}]`, se combinan con AND): cualquier clave de `state.ind`, `turno`, `presion`, `escandaloActivo`, `primaRiesgo` y `ratio.<area>` (gasto actual / gasto base del área).
3. Si querés que pese distinto en un país: `eventMult` en el JSON del país.
4. `npm test` (hay un test que valida que todos los eventos tienen campos válidos).

### Cómo agregar una ley
1. Objeto en `src/data/bills.json`: `id`, `nombre`, `descripcion`, `apoyo` por tipo de bloque, `efectos`
   (inmediatos sobre indicadores) y `mods` (modificadores permanentes: `recaudacion`, `potencial`, `prima`, `riesgoEscandalo`, ...).
2. Si agregás un `mod` nuevo, sumalo al tipo `Mods` en `engine/types.ts` y usalo en el módulo correspondiente.

### Cómo habilitar un país
1. Completar su JSON en `src/data/countries/` (copiá la forma de `argentina.json`).
2. `playable: true`. Darle un problema principal propio (ver tabla de dificultad).
3. Sumarlo a la lista del sim (`src/sim/run.ts` lo toma automático de los jugables) y correr `npm run sim`.

---

## 5. Estado del proyecto (checklist vivo)

### Fase 0 — Setup
- [x] Vite + React + TS + Zustand + Vitest + vite-plugin-pwa
- [x] CLAUDE.md y README

### Fase 1 — Un país jugable (+ PWA) — ✅ HECHA (esperando OK del arquitecto para Fase 2)
- [x] Motor (`src/engine`): `rng`, `types`, `init`, `budget`, `economy`, `politics`, `congress`, `events`,
      `pressure`, `endings`, `score`, `turn` (orquestador), `data` (acceso a JSON), `index` (API pública)
- [x] Datos: `config.ts` (CFG), 3 países jugables (`argentina|brasil|peru.json`), 9 en `proximamente.json`,
      `events.json` (20 eventos), `bills.json` (9 leyes), `texts.ts` (parte y finales)
- [x] UI (`src/ui`): pantallas Inicio, Panel, Presupuesto, Congreso, Parte, Final; store Zustand; tema claro/oscuro
      (botón que cicla auto→oscuro→claro); navegación inferior; accesible por teclado
- [x] Guardado: localStorage automático (try/catch) + export/import JSON con validación (`src/ui/save.ts`)
- [x] PWA: vite-plugin-pwa `autoUpdate`, precache total, manifest es-AR con colores leídos de `theme.css`,
      íconos 64/192/512/maskable + apple-touch 180 generados de `public/icon.svg`, botón Instalar
      (`beforeinstallprompt`), cartel iOS descartable, toast "versión nueva → Recargar" (`onNeedReload`)
- [x] Tests: 30 en `tests/` (rng, presupuesto, Congreso, eventos, turno, finales, legado, smoke del sim)
- [x] Sim: `npm run sim` (tabla) y `npm run sim:debug` (promedios para calibrar)
- [x] README con deploy y subpath (`BASE_PATH`)

**Verificado (Chromium headless, viewport 390×844):** manifest servido y válido, SW activo, recarga offline,
partida completa de 16 turnos offline, navegación por teclado hasta elegir país, sin scroll horizontal,
sin errores de consola, toast de versión nueva tras rebuild, build con `BASE_PATH` (start_url/scope/SW correctos).
**No verificado:** instalación en celular real (Android/iOS) y revisión manual en DevTools.

**Balance actual (400 partidas, semillas 1000–1399):**
```
país       estrategia   victoria reelec legado  finales principales
argentina  equilibrada   38%      22%   52.6   gris 62 · reel 22 · cumpl 17
argentina  populista      0%       0%   29.7   colapso 57 · gris 30 · golpe 10
argentina  austeridad    21%       0%   47.3   gris 78 · cumpl 21
argentina  nada           4%       1%   35.1   gris 68 · colapso 27
brasil     equilibrada   66%      36%   58.7   reel 36 · gris 34 · cumpl 30
brasil     populista      5%      17%   41.0   gris 70 · reel 17 · colapso 14
brasil     austeridad     0%       0%   46.7   gris 100 (la rigidez castiga recortar)
brasil     nada          14%      11%   45.8   gris 85
peru       equilibrada   59%      39%   57.3   reel 39 · gris 39 · cumpl 20
peru       populista     16%      35%   45.6   gris 59 · reel 35
peru       austeridad     6%       4%   47.0   gris 62 · juicio 33
peru       nada          13%      12%   47.1   gris 52 · juicio 34
```
Cada país muere de algo distinto: AR por colapso inflacionario, PE por juicio político, BR porque ajustar no rinde.
Puntos flojos conocidos: "mandato gris" es el final más común; Brasil-austeridad nunca gana (¿demasiada rigidez?).

### Fase 2 — Diplomacia (pendiente, NO arrancar sin OK)
### Fase 3 — Militar (pendiente)
### Fase 4 — 12 países con IA (pendiente)
### Fase 5 — Eventos regionales y puntaje final (pendiente)

---

## 6. Roadmap detallado (Fases 2–5)

### Fase 2 — Diplomacia
1. `state.relaciones: Record<paisId, number>` (-100..100) con todos los países (no solo vecinos; vecinos pesan más).
   Valores iniciales en `src/data/relations.json` (ilustrativos).
2. Acciones diplomáticas por turno (1–2): visita oficial, acuerdo comercial, protesta formal, cooperación
   en seguridad, gesto público (sube aprobación interna, baja relación).
3. Tratados: `comercio` (crecimiento + reservas), `defensa` (alianza: entra en guerra a tu favor o te
   arrastra), `integración` (bloque regional, beneficios y obligaciones). Firmarlos requiere relación ≥ umbral
   y a veces aprobación del Congreso (reusar `congress.resolveBill`).
4. Crisis de frontera: eventos con condición `relacion < X` y vecino con frontera (`vecinos` en JSON de país).
   Se resuelven con opciones (negociar, escalar, ignorar). Escalar repetidamente ⇒ puede disparar guerra (Fase 3).
5. Pantalla "Diplomacia": mapa esquemático (sin banderas) o lista con barras de relación.
6. Sim: agregar estrategia "aislacionista" y "integracionista". Tests de relaciones y tratados.

### Fase 3 — Militar (portar lógica del prototipo)
1. **Declarar la guerra a cualquier país** como decisión explícita del jugador (no solo por crisis
   diplomática). También puede iniciarse desde una crisis de frontera escalada o por ataque de la IA.
2. **Costos de declarar** (todos en CFG):
   - Economía: caída de crecimiento, fuga de reservas, salto obligatorio del gasto en defensa ⇒ déficit ⇒ deuda/emisión.
   - Política: rally de aprobación inicial ("efecto bandera") que **se erosiona** turno a turno; luego desgaste.
   - Congreso: hay que pedir autorización (votación); sin ella ⇒ gobernabilidad se desploma y sube riesgo de juicio político.
   - Diplomacia: caída de relación con el agredido (-100), con sus aliados y con terceros; posibles **sanciones**
     (comercio y reservas); tratados de defensa ajenos pueden sumar enemigos.
   - Sociedad: baja la estabilidad; víctimas reportadas en el parte **con respeto** (sin humor en ese tema).
   - Riesgo de golpe si la guerra sale mal (capacidad militar baja + derrota).
3. **Mecánica de guerra** (del prototipo): cada turno se asigna esfuerzo (puntos que suman 100) entre
   **aire, mar, cordillera/frontera, economía (sostener el frente interno) y diplomacia (buscar mediación)**.
   El resultado por frente es probabilístico según capacidad militar, esfuerzo, geografía (`frentes` en el
   JSON del país: si hay mar, cordillera, selva) y moral.
4. **Presión internacional** creciente cada turno de guerra que fuerza un **cese del fuego** (como en el prototipo).
5. **Finales de guerra**: victoria pírrica, empate/armisticio, cese del fuego impuesto, derrota. Cada uno con
   efectos sobre el resto del mandato y desglose en la pantalla final.
6. La IA de los otros países también puede declarar guerra (Fase 4) según su postura.
7. Sim: estrategias "belicista" y "pacifista"; verificar que declarar guerra **no** sea dominante (debe costar caro).
8. Gancho ya presente en Fase 1: `ind.capacidadMilitar` alimentada por el presupuesto de defensa.
   Agregar `state.guerra?: EstadoGuerra` (opcional ⇒ no rompe saves; subir `SAVE_VERSION` igual).

### Fase 4 — Los 12 países con IA
1. Completar los 12 JSON con perfiles distintos (Bolivia: gobernabilidad y protesta social; Chile: Congreso
   trabado pero macro sólida; Colombia: seguridad; Ecuador: dolarizado ⇒ sin emisión; Guyana: boom petrolero
   y tamaño chico; Paraguay: recaudación baja; Surinam: deuda; Uruguay: estable pero aprobación difícil de
   subir; Venezuela: inflación y aislamiento). Ilustrativos.
2. Cada país no jugado avanza con `ai.decide(state, paisId)` usando su **postura** (prioridades: crecimiento,
   soberanía, integración, populismo...) definida en el JSON.
3. Todos los países en el estado (`state.paises`), el jugador es uno más. Rendimiento: el sim debe seguir corriendo rápido.
4. Sim: IA vs IA para detectar países que pierden desproporcionadamente (como en el prototipo, que encontró 3:1).

### Fase 5 — Eventos regionales, noticias cruzadas, puntaje final
1. Eventos regionales (crisis de commodities regional, migraciones, cumbres) que afectan a varios países.
2. "Noticias cruzadas": el parte incluye lo que pasa en otros países (etiqueta REGIÓN).
3. Pantalla final con desglose completo y ranking regional.

---

## 7. Cómo seguir

Ver "Estado del proyecto". El próximo paso concreto está anotado al final de esta sección.

**Prompt sugerido para retomar en otra sesión** (pegarlo tal cual):
> Leé CLAUDE.md completo. Estamos en el proyecto "Simulador de Gobierno Sudamericano". Implementá la
> siguiente fase pendiente según la sección 6, respetando las convenciones de la sección 4 (motor puro,
> CFG único, RNG con semilla, tests y `npm run sim` con 400 partidas por estrategia). Al terminar: tests,
> sim, commit, actualizá el checklist de CLAUDE.md y resumí en ≤10 líneas. No arranques la fase siguiente sin OK.

**Próximo paso**: esperar OK del arquitecto. Si llega: Fase 2 (Diplomacia), sección 6. Antes, opcional: revisar
balance de Brasil-austeridad (`perfil.rigidez` en `brasil.json`) y la frecuencia de "mandato gris".

---

## 8. Decisiones tomadas (log)

- Fase 1 con 3 países jugables (AR/PE/BR) para probar "dificultad distinta"; los otros 9 aparecen bloqueados.
- Legado medido mayormente como mejora vs. el inicio ⇒ los países difíciles no están condenados.
- Servicio de deuda con mínimo exigible: pagar menos es posible pero sube la prima de riesgo.
- Capacidad militar existe desde Fase 1 (gancho) para que el gasto en defensa tenga sentido antes de la guerra
  (suma a "soberanía" en el legado y desfinanciar FF.AA. sube el riesgo de golpe).
- Estado mutable SOLO dentro de `advanceTurn` sobre un `structuredClone`: los módulos reciben el borrador y lo modifican;
  desde afuera el motor es puro (hay test).
- Emisión medida por trimestre (déficit/4 × parte emitida). `fiscal.emisionInflacion` está calibrado para eso.
- Toast de versión nueva: con `autoUpdate` el SW nuevo se activa solo; usamos `onNeedReload` para NO recargar de prepo
  y dejar que el jugador toque "Recargar" (la partida ya está guardada en cada acción).
- Colores del manifest se leen con regex del bloque `:root` de `src/ui/theme.css` en `vite.config.ts` (fuente única).
- Opción "ajustar pago de deuda al mínimo automáticamente" (activa por defecto) para que el jugador no caiga en atraso
  por olvido cuando suben los intereses. Es estado de UI, no del motor.
- Estrategias del sim (`src/sim/strategies.ts`): equilibrada, populista, austeridad, nada. En Fase 4 se reutilizan como
  base de la IA por "postura".

### Pendiente / no verificado
- Instalación de la PWA en un celular real (Android/iOS) — solo se puede verificar a mano.
