# CLAUDE.md — Simulador de Gobierno Sudamericano

> Documento de traspaso. Si sos un agente nuevo: leé esto entero antes de tocar nada.
> Acá está **qué es el juego, cómo está armado, qué está hecho, qué falta y cómo seguir**.
> Mantenelo actualizado en cada commit (sobre todo la sección "Estado del proyecto").

---

## 1. Visión y tono

- Simulador de gobierno **por turnos**. El jugador es presidente/a de un país de Sudamérica y administra
  presupuesto, política interna (Congreso), diplomacia y fuerzas armadas (incluida la guerra).
- **1 turno = 1 trimestre. Mandato = 16 turnos (4 años).**
- **Victoria**: puntaje de *legado* al final del mandato (crecimiento, estabilidad, bienestar, soberanía,
  aprobación) + bonus si hay reelección.
- **Derrotas anticipadas**: crisis de gobernabilidad, colapso económico, golpe, juicio político.
- Origen: prototipo "Simulador Cono Sur" (guerra AR vs CL por turnos, HTML único). De ahí heredamos:
  motor puro, CFG único, RNG con semilla, simulación headless de balance, eventos con condiciones,
  parte por turno con etiquetas, presión creciente que fuerza el final, pantalla final con desglose y
  mensaje irónico.
- **Premisa de diseño (arquitecto, oct. 2026): "que pueda pasar y hacer de todo".** El juego NO está orientado al
  pacifismo ni a ninguna ideología: la guerra, la conquista y (a futuro) quebrar las instituciones son caminos
  **jugables con chances reales**, con costos y riesgos proporcionados. El sim lo vigila: ninguna estrategia debe
  dominar, pero tampoco ser un suicidio garantizado (ver "Cómo tocar la guerra").
- **Tono**: humor rioplatense leve. **Nunca** banalizar víctimas (ni en eventos, ni en guerra, ni en catástrofes).
  Lo militar y lo represivo se narran en serio; en el mapa, siluetas abstractas y nada sobre población.
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
  data/     ← config.ts (CFG: TODO el balance), countries/*.json, events.json, bills.json, texts.ts,
              mapa.ts (geometría esquemática del mapa: fronteras compartidas → path SVG por país)
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
         2. war.resolverDeclaracion / diplomacy.resolverTratado / congress.resolverLey
            → UNA votación por turno (prioridad: autorización de guerra > tratado > ley)
         2b. diplomacy.aplicarAcciones → visitas, cooperación, protestas, gestos
         3. economy.stepEconomy     → crecimiento, inflación, desempleo, reservas, deuda/PBI (+ bonusDiplomatico)
         4. events.rollEvents       → eventos con condiciones (shocks), efectos inmediatos y temporales
         4b. diplomacy.stepRelaciones + stepCrisis → deriva de relaciones, obligaciones, crisis de frontera
         4c. war.stepAtaqueEnemigo + stepGuerra + stepSanciones → ataque en crisis nivel 3, combate, sanciones
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

### Modelo (Fase 2 — Diplomacia)
- **Relaciones** (`state.relaciones`, -100..100) con los otros 11 países; base en `src/data/relations.json`
  (pares no listados = `CFG.diplomacia.relacionDefault`). Derivan hacia la base cada turno.
  Vecinos y `pesoComercial` en `src/data/geografia.json`.
- **Acciones** (máx. 2 por turno): `visita` (+rel con rendimientos decrecientes), `cooperacion` (+rel, +estabilidad,
  requiere rel ≥ 0), `protesta` (−rel; +aprobación si es contra quien tenés crisis), `gesto` (+aprobación, −rel).
- **Tratados** (se votan en el Congreso con `congress.votar`, apoyo por tipo de bloque en CFG; requieren relación mínima;
  no se firma con quien tenés crisis): `comercio` (crecimiento/reservas × pesoComercial, con techo),
  `defensa` (+capacidad militar una vez; escalar crisis con terceros cuesta la mitad), `integracion` (−prima y
  +crecimiento una vez; obligación: no emitir y déficit ≤ máx., si no, se castiga la relación con los socios).
- **Crisis de frontera** (`state.crisis`): nace con el peor vecino si la relación < umbral. Respuestas: negociar
  (baja nivel), escalar (sube nivel, rally de aprobación, cuesta reservas/crecimiento/prima), ignorar. Cuesta por
  turno según nivel. **Nivel 3 = gancho de Fase 3** (hoy: mediación internacional que puede bajarla).
- **Legado**: la mejora de la relación promedio suma a "soberanía" (prestigio regional).
- Eventos con `tag: DIPLOMACIA` y campo `diplomacia: { objetivo, delta }`; condiciones `relMinVecinos`, `relPromedio`.

### Modelo (Fase 3 — Guerra)
- **Declarar** (`Decisiones.guerra.declarar`): contra cualquiera de los 11. Ocupa la votación del turno (autorización
  del Congreso con `congress.votar`; apoyo en `CFG.guerra.autorizacion`, más si hay crisis o relación < −50, menos si
  es socio de tratado). Si la rechaza: `siRechaza: 'desistir' | 'avanzar'` (decreto ⇒ −gobernabilidad y habilita
  juicio político aunque no haya escándalo).
- **Costos al declarar** (`war.iniciarGuerra`): relación −100 con el atacado; terceros, vecinos del atacado y tus
  socios de defensa bajan su relación; tratados con el atacado suspendidos; reservas y prima; rally de aprobación;
  sanciones si la relación promedio queda < 0. Piso de gasto en defensa (×`multDefensaGuerra`) forzado en `turn.ts`.
- **Guerra defensiva**: con crisis de frontera en nivel 3, el rival ataca con `probAtaqueNivel3` por turno
  (autorizada de hecho, rally mayor, bonus de pelear en casa, socios de defensa suman capacidad).
- **Combate** (`war.stepGuerra`, desde el turno siguiente a la declaración): esfuerzo (suma 100) entre aire, mar,
  frontera, economía y diplomacia. Frentes según geografía (`militar.json` + vecinos): aire siempre, mar si ambos
  tienen costa, frontera si son vecinos. Cada frente: sigmoide(propio − enemigo) con capacidad × esfuerzo × moral.
  Ganar suma avance y desgasta al enemigo; perder resta avance, capacidad y moral. IA enemiga: reparte parejo con ruido.
- **Costos por turno**: crecimiento, reservas (alivia el esfuerzo en "economía"), estabilidad, aprobación (desgaste)
  y **costo humano** (índice 0–100, narrado con respeto: `LINEAS_GUERRA` en `texts.ts`).
- **Presión internacional**: sube cada turno (menos si es defensiva o con esfuerzo diplomático; más con costo humano).
  En 100 ⇒ cese del fuego impuesto.
- **Finales**: victoria (avance ≥ 60), derrota (≤ −60), armisticio (si se propone; prob. por diplomacia, presión y
  avance), cese impuesto. Efectos en `CFG.guerra.fin`; la relación base con el ex enemigo queda en −30.
  Derrota reciente ⇒ ×`golpePorDerrota` en riesgo de golpe. Perder una guerra NO termina la partida por sí sola.
- **Legado**: resultado ⇒ soberanía (`CFG.guerra.legado`), costo humano ⇒ estabilidad. `legado.guerra` es informativo.

### Modelo (Fase 4 — Mapa y conquista)
- **Mapa** (`src/data/mapa.ts` + `ui/components/MapaSudamerica.tsx`): geometría esquemática propia; cada frontera se
  define una vez y se reutiliza (`fronteraEntre`, `puntosSobre`, `costaDe`, `centroDe` para la capa de guerra).
  Malvinas como territorio en disputa (administradas de facto por el RU); Guayana Francesa neutra.
- **Territorio** (`state.territorios: Territorio[]`, `engine/territory.ts`): franja junto a la frontera común
  (`profundidad` 0..1). Solo entre **vecinos** (sin frente terrestre no se ocupa suelo). Al terminar una guerra
  (`territorioPorGuerra`): victoria ⇒ franja plena; derrota ⇒ la perdés; **armisticio ⇒ se congela la línea**
  (`avance / umbralVictoria`); cese impuesto ⇒ fronteras previas. Ganar primero recupera lo propio (`transferir`).
- **Retenerlo rinde** (`bonusTerritorial`, consumido por `economy` y `budget.recaudacionEfectiva`): crecimiento
  (más si el ocupado tiene peso comercial), recaudación, reservas y soberanía en el legado. **Cuesta**
  (`stepTerritorios`): resistencia (estabilidad, decae con el asentamiento), piso de defensa por guarnición
  (`multPisoDefensa`, combinado con el de guerra en `turn.pisoDefensa`), relación base con el ocupado fija en −60,
  terceros te miran peor y **revancha** (el ocupado abre crisis de nivel 2). Si te ocupan: −aprobación por turno.
- **Acciones** `devolver` (fin de la ocupación, +relación, −aprobación, la región celebra) y `reclamar` (requiere
  relación mínima; prob. según relación). Las resuelve `aplicarAccionesTerritoriales` (no `aplicarAcciones`).
- **Victoria militar**: reparaciones (+reservas) y la gloria en el legado escala con la capacidad del rival vs. la
  propia inicial (`CFG.guerra.gloria`): ganarle a uno muy chico vale poco.
- **Mapa en guerra** (`ui/components/MapaGuerra.tsx`): franja móvil según el avance (anima desde el trimestre anterior,
  `guerraPrevia` en el store), tanques/aviones/barcos en siluetas según `ultimosFrentes`, destellos SOLO en la línea del
  frente; territorio permanente rayado con la nueva línea de hecho. En el Panel, solo franjas. SMIL se apaga con
  `prefers-reduced-motion` (lo detecta el componente; el CSS no alcanza a SMIL).

### Dificultad por país (difícil *de forma distinta*)
| País | Problema principal | Cómo se modela |
|---|---|---|
| Argentina | Inflación con inercia, reservas flacas | `inercia` alta, inflación inicial alta, reservas bajas, emisión pega más |
| Perú | Congreso fragmentado y hostil | muchos bloques chicos, afinidad baja, disciplina baja, `riesgoJuicio` alto |
| Brasil | Deuda alta y gasto rígido | deuda/PBI alta, tasa base alta (9), presupuesto base rígido (cortar duele más) |

En Fase 2 además: Perú casi no logra ratificar tratados (Congreso hostil); Brasil tiene 9 vecinos (más frentes de
crisis, p. ej. relación baja con Venezuela); Argentina arranca tensa con Chile.

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

### Cómo agregar una acción diplomática o un tratado
1. Sumá el tipo en `TipoAccion` / `TipoTratado` (`engine/types.ts`) y en `TIPOS_ACCION` / `TIPOS_TRATADO` (`engine/diplomacy.ts`).
2. Sus números en `CFG.diplomacia.acciones` / `CFG.diplomacia.tratados` (un tratado necesita `relacionMin` y `apoyo` por tipo de bloque).
3. Efecto: acción en `aplicarAcciones`; tratado en `bonusDiplomatico` (si es económico) o en `resolverTratado` (si es one-shot).
4. UI: `ACCIONES` / `NOMBRE_TRATADO` en `src/ui/components/AccionesPais.tsx`; `AYUDA_TRATADO` en `src/ui/screens/Diplomacia.tsx`.
5. Tests en `tests/engine/diplomacy.test.ts` y `npm run sim`.

### Cómo tocar la guerra
- Números: todos en `CFG.guerra`. Capacidades enemigas y costas: `src/data/militar.json`.
- Un frente nuevo: sumalo a `FrenteMilitar` (types), `FRENTES`/`DESTINOS` y `frentesDisponibles` (`war.ts`),
  `NOMBRE_FRENTE` (`texts.ts`) y `NOMBRE_DESTINO` (`ui/components/GuerraCard.tsx`).
- Textos de guerra: siempre en `LINEAS_GUERRA`, tono serio. Sin humor sobre víctimas.
- Territorio: números en `CFG.guerra.ocupacion` / `devolver` / `reclamar`; lógica en `engine/territory.ts`.
- Después: `npm test && npm run sim`. **Objetivo de balance** (premisa "de todo"): `belicista` con chances
  comparables a `equilibrada` (±15 pp de victoria), sin dominar claramente ni volver a ser un suicidio (0–10%).

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

### Fase 2 — Diplomacia — ✅ HECHA (esperando OK del arquitecto para Fase 3)
- [x] Datos: `geografia.json` (vecinos reales + pesoComercial ilustrativo), `relations.json`, bloque `CFG.diplomacia`,
      4 eventos `DIPLOMACIA`
- [x] Motor: `engine/diplomacy.ts` (acciones, tratados, crisis, deriva, bonus), `congress.votar` genérico,
      integración en `turn`, `economy`, `politics`, `events`, `score`; `STATE_VERSION` 2
- [x] Guardado: `SAVE_VERSION` 2 con migración v1→v2 (`migrarSave` en `src/ui/save.ts`)
- [x] UI: pantalla Diplomacia (crisis, acciones, tratados con votos esperados, lista de países), pestaña nueva,
      alertas en el Panel, resumen regional en el Final
- [x] Fixes de UI: `scroll-padding` para que el foco no quede bajo la barra fija; toast arriba y el de offline se cierra solo
- [x] Sim: estrategias `aislacionista` e `integracionista`; todas con política diplomática; columnas crisis/nivel 3/tratados
- [x] Tests: 46 (nuevos: `tests/engine/diplomacy.test.ts`, `tests/save.test.ts`)

**Verificado (Chromium headless 390×844):** acciones (límite 2), propuesta y ratificación de tratado, entradas
DIPLOMACIA en el parte, relaciones conservadas tras recarga offline, partida completa, sin scroll horizontal ni errores.

**Balance Fase 2 (400 partidas, semillas 1000–1399; crisis = % partidas con crisis, niv3 = llegaron a nivel 3):**
```
país       estrategia       victoria reelec legado turnos NaN crisis niv3 trat  finales
argentina  equilibrada       55%      28%   57.0  16.0    0    0%   0%  5.0  gris 46% · reel 28% · cumpl 27%
argentina  populista          0%       0%   31.2  11.2    0   69%  56%  0.0  colap 84% · gris 14% · golpe 1% · juicio 0%
argentina  austeridad        36%       0%   50.5  16.0    0    0%   0%  4.9  gris 64% · cumpl 36% · juicio 0%
argentina  nada               3%       1%   36.1  14.6    0   22%   0%  0.0  gris 77% · colap 17% · cumpl 2% · juicio 2% · reel 1% · golpe 0%
argentina  aislacionista     41%      23%   53.6  16.0    0   22%   0%  0.0  gris 59% · reel 23% · cumpl 18%
argentina  integracionista   40%      16%   50.4  16.0    0    0%   0% 11.2  gris 60% · cumpl 24% · reel 16%
brasil     equilibrada       71%      37%   59.1  16.0    0    0%   0%  8.1  reel 37% · cumpl 34% · gris 29%
brasil     populista          0%       0%   28.9  11.5    0   62%  49%  0.0  colap 100% · gris 0%
brasil     austeridad         0%       0%   46.4  16.0    0    1%   0%  4.6  gris 100% · reel 0%
brasil     nada               0%       1%   28.7  16.0    0   66%   0%  0.0  gris 100% · reel 1%
brasil     aislacionista     48%      34%   55.8  16.0    0   67%   0%  0.0  gris 52% · reel 34% · cumpl 14%
brasil     integracionista   54%      26%   56.7  16.0    0    0%   0% 11.4  gris 46% · cumpl 29% · reel 26%
peru       equilibrada       62%      42%   58.1  15.9    0    2%   0%  0.1  reel 42% · gris 36% · cumpl 20% · juicio 2%
peru       populista         11%      34%   40.7  14.9    0   77%  69%  0.0  reel 34% · colap 33% · gris 33% · juicio 1%
peru       austeridad         5%       4%   48.3  14.9    0    2%   0%  0.0  gris 64% · juicio 31% · reel 4% · cumpl 2%
peru       nada              12%      15%   47.2  15.0    0   71%   0%  0.0  gris 61% · juicio 24% · reel 15% · cumpl 1%
peru       aislacionista     53%      41%   56.2  16.0    0   75%   0%  0.0  gris 45% · reel 41% · cumpl 13% · juicio 2%
peru       integracionista   70%      43%   59.2  15.9    0    2%   0%  2.2  reel 43% · gris 29% · cumpl 27% · juicio 2%
```
Lectura: ser activo en diplomacia vale ~10–20 pp de victoria vs. aislarse, sin dominar (integracionista resigna leyes).
Escalar crisis (populista) llega a nivel 3 en ~50–70% de partidas. Perú casi no ratifica tratados (Congreso hostil).
Puntos flojos: Brasil-equilibrada en el límite (71%); Brasil-austeridad y "nada" nunca ganan; "gris" sigue siendo común.

### Fase 3 — Militar — ✅ HECHA (esperando OK del arquitecto para Fase 4)
- [x] Datos: `militar.json` (capacidad ilustrativa + costa), bloque `CFG.guerra`, `LINEAS_GUERRA` (tono serio)
- [x] Motor: `engine/war.ts` (declaración + autorización, costos, ataque enemigo en crisis nivel 3, frentes por
      geografía, esfuerzo, presión internacional, armisticio, finales, sanciones); piso de defensa en `turn.ts`;
      golpe/juicio en `endings.ts`; legado en `score.ts`; `STATE_VERSION` 3
- [x] Guardado: `SAVE_VERSION` 3, migración encadenada v1→v2→v3
- [x] UI: pestaña "Exterior" (ex Diplomacia); diálogo `<dialog>` de declaración con costos y votos esperados
      (foco en "Cancelar", Escape cierra); tarjeta del conflicto con sliders de esfuerzo y armisticio; resumen en Panel
      y desglose de conflictos en el Final
- [x] Sim: estrategias `belicista` y `pacifista`; columnas guerra / gMil (% guerras ganadas) / durG (turnos)
- [x] Tests: 63 (nuevos: `tests/engine/war.test.ts`, migración v2→v3)

**Verificado (Chromium headless 390×844):** declaración desde el diálogo (teclado, Escape), votación en el parte,
tarjeta del conflicto, sliders normalizados, guerra conservada tras recarga offline, fin de guerra y desglose en el
Final, sin scroll horizontal ni errores de consola.

**Balance Fase 3 (400 partidas, semillas 1000–1399; guerra = % partidas con guerra; gMil = % guerras ganadas;
durG = turnos promedio por guerra):**
```
país       estrategia       victoria reelec legado turnos NaN crisis niv3 trat guerra gMil durG  finales
argentina  equilibrada       55%      28%   57.0  16.0    0    0%   0%  5.0    0%    -  0.0  gris 46% · reel 28% · cumpl 27%
argentina  populista          0%       0%   31.0  11.1    0   69%  56%  0.0   22%   0%  1.0  colap 86% · gris 13% · golpe 1% · juicio 0%
argentina  austeridad        36%       0%   50.5  16.0    0    0%   0%  4.9    0%    -  0.0  gris 64% · cumpl 36% · juicio 0%
argentina  nada               3%       1%   36.1  14.6    0   22%   0%  0.0    0%    -  0.0  gris 77% · colap 17% · cumpl 2% · juicio 2% · reel 1% · golpe 0%
argentina  aislacionista     41%      23%   53.6  16.0    0   22%   0%  0.0    0%    -  0.0  gris 59% · reel 23% · cumpl 18%
argentina  integracionista   40%      16%   50.4  16.0    0    0%   0% 11.2    0%    -  0.0  gris 60% · cumpl 24% · reel 16%
argentina  belicista         10%      16%   41.0  16.0    0   98%  96%  1.5  100%  45%  4.3  gris 83% · reel 16% · cumpl 1%
argentina  pacifista         55%      28%   57.0  16.0    0    0%   0%  5.0    0%    -  0.0  gris 46% · reel 28% · cumpl 27%
brasil     equilibrada       71%      37%   59.1  16.0    0    0%   0%  8.1    0%    -  0.0  reel 37% · cumpl 34% · gris 29%
brasil     populista          0%       0%   29.0  11.4    0   62%  49%  0.0   23%  11%  1.4  colap 100% · gris 0%
brasil     austeridad         0%       0%   46.4  16.0    0    1%   0%  4.6    0%    -  0.0  gris 100% · reel 0%
brasil     nada               0%       1%   28.7  16.0    0   66%   0%  0.0    0%    -  0.0  gris 100% · reel 1%
brasil     aislacionista     48%      34%   55.8  16.0    0   67%   0%  0.0    0%    -  0.0  gris 52% · reel 34% · cumpl 14%
brasil     integracionista   54%      26%   56.7  16.0    0    0%   0% 11.4    0%    -  0.0  gris 46% · cumpl 29% · reel 26%
brasil     belicista          0%       5%   23.4  16.0    0  100%  99%  0.2  100%  61%  4.2  gris 96% · reel 5%
brasil     pacifista         71%      37%   59.1  16.0    0    0%   0%  8.1    0%    -  0.0  reel 37% · cumpl 34% · gris 29%
peru       equilibrada       62%      42%   58.1  15.9    0    2%   0%  0.1    0%    -  0.0  reel 42% · gris 36% · cumpl 20% · juicio 2%
peru       populista         10%      27%   38.9  14.4    0   77%  69%  0.0   48%  21%  3.1  colap 46% · reel 27% · gris 27% · juicio 1%
peru       austeridad         5%       4%   48.3  14.9    0    2%   0%  0.0    0%    -  0.0  gris 64% · juicio 31% · reel 4% · cumpl 2%
peru       nada              12%      15%   47.2  15.0    0   71%   0%  0.0    0%    -  0.0  gris 61% · juicio 24% · reel 15% · cumpl 1%
peru       aislacionista     53%      41%   56.2  16.0    0   75%   0%  0.0    0%    -  0.0  gris 45% · reel 41% · cumpl 13% · juicio 2%
peru       integracionista   70%      43%   59.2  15.9    0    2%   0%  2.2    0%    -  0.0  reel 43% · gris 29% · cumpl 27% · juicio 2%
peru       belicista          1%      33%   37.7  15.5    0  100%  98%  0.0  100%  47%  4.2  gris 48% · reel 33% · juicio 19%
peru       pacifista         62%      42%   58.1  15.9    0    2%   0%  0.1    0%    -  0.0  reel 42% · gris 36% · cumpl 20% · juicio 2%
```
Lectura (histórica, superada en Fase 4 por cambio de premisa): la guerra NO convenía. Belicista ganaba 0–10% (vs 55–71% equilibrada) aunque gane ~45–60% de sus guerras;
dura ~4 turnos. En Perú, la guerra sin autorización termina en juicio político (19%). Las guerras defensivas aparecen
con quien escala crisis (populista). Pacifista = equilibrada porque casi nunca la atacan.

### Fase 4 — Mapa + guerra en el mapa + conquista — ✅ HECHA (esperando OK del arquitecto para Fase 5)
- [x] Datos: `src/data/mapa.ts` — mapa esquemático original low-poly de los 12 países (+ Guayana Francesa neutra, sin
      interacción). Cada frontera se define una vez (lon/lat) y los países se arman encadenándolas (falla al cargar si
      un tramo no continúa). Proyección equirectangular simple.
- [x] Motor: `engine/region.ts` → `situacionPais(state, id)` (relación, vecino, tratados, crisis, guerra, capacidad,
      peso comercial). Puro, solo lectura. Va en módulo propio para no crear un ciclo diplomacy ↔ war.
- [x] UI: `MapaSudamerica` (color por relación con `color-mix`, rayado de crisis/guerra, puntos de tratado, contorno del
      seleccionado, cada país es `role=button` con Tab/Enter/Espacio y `aria-label` descriptivo, área táctil para los
      chicos) + `LeyendaMapa` (HTML). Pestaña Exterior: mapa + **ficha del país** con las mismas acciones que la lista
      (`AccionesPais`, extraído de la tarjeta). Mapa compacto (solo lectura) en Panel y Final. Tokens `--color-map-*`.
- [x] Malvinas: dibujadas como **territorio en disputa** (trama neutra, "administradas de facto por el Reino Unido"),
      sin asignar a ningún país y agrandadas ×1,6 para que se vean. Gancho: guerra futura por las islas (sumar al RU como actor).
- [x] Mapa vistoso: mar con degradé y cuadrícula, sombra de la tierra, entrada escalonada de países, transición de color
      al cambiar la relación, resaltado + **cartel** al pasar/enfocar, selección con borde animado, **líneas** desde tu país
      (tratados que fluyen, tensión de crisis/guerra), pulsos en crisis/guerra, "+5 / −8" del último trimestre
      (`relacionesPrevias` en el store de UI, no se guarda). Todo CSS/SVG, sin librerías; `prefers-reduced-motion` lo apaga.
- [x] **Conquista permanente** (`engine/territory.ts`, `state.territorios`, `STATE_VERSION`/`SAVE_VERSION` 4 con migración
      v3→v4): victoria/derrota/armisticio cambian fronteras; beneficios y costos de ocupar; `devolver`/`reclamar`;
      reparaciones de guerra; gloria escalada por rival. UI: diálogo de declaración y tarjeta del conflicto avisan qué
      territorio está en juego; ficha, chips de la lista ("OCUPÁS 60%") y Final lo muestran; acciones territoriales
      solo aparecen si corresponden.
- [x] **Guerra en el mapa**: franja móvil, territorio permanente, tanques/aviones/barcos y destellos en el frente.
- [x] **Rebalance pro-"de todo"**: guerra más decisiva (avance 7→9, sigmoide 10→8), menos drenaje de reservas
      (−0,4→−0,2/turno; −1→−0,5 al declarar), victoria con reparaciones y más legado (6→16 × gloria). Estrategia
      `belicista` reescrita (vecino más débil, armisticio al ir ganando, consolida entre guerras).
- [x] Fix: no nacen crisis de frontera nuevas durante una guerra (antes salía "crisis con Paraguay" en plena guerra con Paraguay).
- [x] Tests: 85 (nuevos: `tests/mapa.test.ts`, `tests/engine/region.test.ts`, `tests/engine/territory.test.ts`,
      migración v3→v4, crisis en guerra). Sim: columna `terr` (territorio neto al final).

**Verificado (Chromium, 390×844 y 1280×900, temas claro y oscuro):** 12 países enfocables con nombre accesible,
Enter abre la ficha, toque en Uruguay selecciona, "Visita" y "Devolver territorio" desde la ficha suman la acción,
crisis/guerra/territorio marcados, franja que crece al cerrar el trimestre, unidades visibles en ambos temas, Panel
solo con franjas, `prefers-reduced-motion` sin animaciones, sin scroll horizontal ni errores de consola.

**Balance Fase 4 (400 partidas, semillas 1000–1399; terr = territorio neto al final, + ganado / − perdido):**
```
país       estrategia       victoria reelec legado turnos NaN crisis niv3 trat guerra gMil durG  terr  finales
argentina  equilibrada       55%      28%   57.0  16.0    0    0%   0%  5.0    0%    -  0.0  0.00  gris 46% · reel 28% · cumpl 27%
argentina  populista          0%       0%   31.1  11.1    0   69%  56%  0.0   22%   1%  1.1  0.00  colap 86% · gris 13% · golpe 1% · juicio 0%
argentina  austeridad        36%       0%   50.5  16.0    0    0%   0%  4.9    0%    -  0.0  0.00  gris 64% · cumpl 36% · juicio 0%
argentina  nada               3%       1%   36.1  14.6    0   22%   0%  0.0    0%    -  0.0  0.00  gris 77% · colap 17% · cumpl 2% · juicio 2% · reel 1% · golpe 0%
argentina  aislacionista     41%      23%   53.6  16.0    0   22%   0%  0.0    0%    -  0.0  0.00  gris 59% · reel 23% · cumpl 18%
argentina  integracionista   40%      16%   50.4  16.0    0    0%   0% 11.2    0%    -  0.0  0.00  gris 60% · cumpl 24% · reel 16%
argentina  belicista         44%      26%   52.8  16.0    0   57%   0%  0.1  100%  40%  3.1  0.89  gris 55% · reel 26% · cumpl 20%
argentina  pacifista         55%      28%   57.0  16.0    0    0%   0%  5.0    0%    -  0.0  0.00  gris 46% · reel 28% · cumpl 27%
brasil     equilibrada       71%      37%   59.1  16.0    0    0%   0%  8.1    0%    -  0.0  0.00  reel 37% · cumpl 34% · gris 29%
brasil     populista          0%       0%   28.9  11.7    0   62%  49%  0.0   23%  29%  1.7  0.07  colap 100% · gris 1%
brasil     austeridad         1%       0%   46.5  16.0    0    1%   0%  4.7    0%    -  0.0  0.00  gris 100% · cumpl 0% · reel 0%
brasil     nada               0%       1%   28.7  16.0    0   66%   0%  0.0    0%    -  0.0  0.00  gris 100% · reel 1%
brasil     aislacionista     48%      34%   55.8  16.0    0   67%   0%  0.0    0%    -  0.0  0.00  gris 52% · reel 34% · cumpl 14%
brasil     integracionista   54%      26%   56.7  16.0    0    0%   0% 11.4    0%    -  0.0  0.00  gris 46% · cumpl 29% · reel 26%
brasil     belicista         79%      53%   61.8  16.0    0   76%   0%  0.4  100%  82%  3.0  0.99  reel 53% · cumpl 26% · gris 21%
brasil     pacifista         71%      37%   59.1  16.0    0    0%   0%  8.1    0%    -  0.0  0.00  reel 37% · cumpl 34% · gris 29%
peru       equilibrada       62%      42%   58.1  15.9    0    2%   0%  0.1    0%    -  0.0  0.00  reel 42% · gris 36% · cumpl 20% · juicio 2%
peru       populista         13%      30%   41.0  15.0    0   77%  69%  0.0   48%  40%  3.0  0.19  colap 35% · gris 33% · reel 30% · juicio 2%
peru       austeridad         5%       4%   48.3  14.9    0    2%   0%  0.0    0%    -  0.0  0.00  gris 64% · juicio 31% · reel 4% · cumpl 2%
peru       nada              12%      15%   47.2  15.0    0   71%   0%  0.0    0%    -  0.0  0.00  gris 61% · juicio 24% · reel 15% · cumpl 1%
peru       aislacionista     53%      41%   56.2  16.0    0   75%   0%  0.0    0%    -  0.0  0.00  gris 45% · reel 41% · cumpl 13% · juicio 2%
peru       integracionista   70%      43%   59.2  15.9    0    2%   0%  2.2    0%    -  0.0  0.00  reel 43% · gris 29% · cumpl 27% · juicio 2%
peru       belicista         49%      45%   55.2  15.7    0   66%   0%  0.0  100%  42%  3.2  0.89  reel 45% · gris 38% · juicio 9% · cumpl 8%
peru       pacifista         62%      42%   58.1  15.9    0    2%   0%  0.1    0%    -  0.0  0.00  reel 42% · gris 36% · cumpl 20% · juicio 2%
```
Lectura: la guerra ahora es **una vía real**. Belicista: AR 44% (vs 55% equilibrada), PE 49% (vs 62%), BR 79%
(vs 71%: Brasil es la potencia regional y le rinde; vigilar). Gana 40–80% de sus guerras y termina con ~0,9 de franja.
Pacifista sigue = equilibrada. **Punto a revisar por el arquitecto:** ¿Brasil-belicista 79% es aceptable o lo bajamos?

### Fase 5 — Ciclo político: partida continua + elecciones (pendiente)
### Fase 6 — Poder de facto: estado de sitio, autogolpe, dictadura (pendiente)
### Fase 7 — El mundo te habla: eventos con decisiones + iniciativas de otros países (pendiente)
### Fase 8 — Más herramientas de gobierno (pendiente)
### Fase 9 — 12 países con IA, actores extrarregionales (Malvinas), eventos regionales (pendiente)

---

## 6. Roadmap detallado

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

### Fase 4 — Mapa + guerra en el mapa + conquista ✅ (ver checklist)

> Desde acá el roadmap se reordenó (octubre 2026) después de jugar el MVP: el arquitecto quiere mecánicas estilo
> "Yo Presidente" / "Iron Hearts". Decisiones: perder una elección presidencial = fin de partida; 1 reelección
> consecutiva (otra solo con reforma constitucional); Supabase más adelante.

### Fase 5 — Ciclo político: partida continua + elecciones
1. Sacar el fin forzado en el turno 16 (`endings.ts`, `CFG.turnosMandato`); botón "Dejar el cargo" (retiro voluntario
   ⇒ pantalla final con el legado acumulado).
2. `state.mandato` (número, turno de inicio). Elección presidencial cada 16 turnos (reusar la lógica de reelección);
   perderla = fin de partida. Límite: 1 reelección consecutiva; ley especial de reforma constitucional para otra.
3. Medio término (turno 8 de cada mandato): recompone escaños de los bloques del Congreso según aprobación.
4. Campaña: 1–2 turnos antes de cada elección, acciones de campaña (actos, promesas = gasto futuro, debates).
5. Legado acumulado por mandato; presión con reseteo parcial al empezar un mandato ("luna de miel").
6. Sim: jugar hasta perder o un tope de seguridad (~80 turnos); medir mandatos promedio. `SAVE_VERSION` 5 + migración.
7. Dejar el gancho para la Fase 6: al perder la elección, el "fin de partida" pasa a ser una decisión (entregar o no el poder).

### Fase 6 — Poder de facto: estado de sitio, autogolpe, "dictador" (pedido del arquitecto)
Que se pueda **retener el poder por la fuerza**, por ejemplo al perder una elección. Es un camino jugable con chances
reales (premisa "de todo"), no un final automático. Tono serio: la represión no se banaliza.
1. **Estado de sitio** (decisión del turno, con o sin Congreso): suspende garantías N turnos. +estabilidad/seguridad
   de corto plazo y −protesta; −aprobación, −relaciones, sanciones, presión internacional; la oposición se radicaliza.
2. **Desconocer una elección perdida / autogolpe**: en vez de "fin de partida" al perder, opción "no entregar el poder".
   Requiere apoyo de las FF.AA. (capacidad militar, defensa financiada, malestar militar bajo): si falla ⇒ golpe en
   contra / caída. Si sale ⇒ **régimen de facto** (`state.regimen: 'democracia' | 'de_facto'`).
3. **Régimen de facto**: Congreso disuelto o cooptado (las leyes salen por decreto), sin elecciones (o controladas, con
   riesgo de fraude visible), censura (la aprobación "medida" sube pero la real cae), represión (estabilidad de corto
   plazo, costo humano narrado con respeto), aislamiento: sanciones, tratados suspendidos, relaciones en caída.
   Riesgos propios: **levantamiento popular**, **contragolpe**, **guerra civil** (reusar el motor de guerra con frentes
   internos), presión internacional y fuga de capitales.
4. **Salidas**: transición pactada (elecciones con garantías), exilio, caída. Legado con lectura propia (la historia
   juzga "orden" vs "libertades").
5. Sim: estrategia `autoritaria` (retiene el poder al perder); objetivo de balance como el resto: chances reales, sin dominar.

### Fase 7 — El mundo te habla
1. Eventos con decisiones: `opciones: [{texto, efectos}]` en `events.json`; el turno queda pendiente hasta elegir
   (en el sim, elige la estrategia). +30–40 eventos nuevos (buenos y malos) y cadenas (`requiere`/`flags`).
2. Iniciativas de otros países (`engine/ai.ts`, liviano): según relación y postura (en el JSON del país) proponen
   tratados, piden ayuda, protestan, ofrecen inversión, escalan crisis. Llegan como propuestas aceptar/rechazar/negociar.

### Fase 8 — Más herramientas de gobierno
Gabinete (ministros con atributos, renuncias), decretos, referéndum, acuerdo con el FMI, privatizar/estatizar,
reformas de varios turnos, cadena nacional. Números en CFG, test por módulo.

### Fase 9 — Los 12 países con IA + actores extrarregionales + eventos regionales
1. Completar los 12 JSON con perfiles distintos (Bolivia: gobernabilidad y protesta social; Chile: Congreso
   trabado pero macro sólida; Colombia: seguridad; Ecuador: dolarizado ⇒ sin emisión; Guyana: boom petrolero
   y tamaño chico; Paraguay: recaudación baja; Surinam: deuda; Uruguay: estable pero aprobación difícil de
   subir; Venezuela: inflación y aislamiento). Ilustrativos.
2. Cada país no jugado avanza con `ai.decide(state, paisId)` usando su **postura** (prioridades: crecimiento,
   soberanía, integración, populismo...) definida en el JSON.
3. Todos los países en el estado (`state.paises`), el jugador es uno más. Rendimiento: el sim debe seguir corriendo rápido.
4. Sim: IA vs IA para detectar países que pierden desproporcionadamente (como en el prototipo, que encontró 3:1).
5. IA que también conquista y reclama territorio (`territory.transferir` ya es genérico entre dos países).
6. **Actores extrarregionales** (p. ej. el Reino Unido por Malvinas): sin frontera terrestre ⇒ frentes aire/mar;
   el territorio en disputa (`MAPA_OTROS` con `disputa`) cambia de color entero si se gana. Pedido del arquitecto.

**Eventos regionales, noticias cruzadas, puntaje final:**
1. Eventos regionales (crisis de commodities regional, migraciones, cumbres) que afectan a varios países.
2. "Noticias cruzadas": el parte incluye lo que pasa en otros países (etiqueta REGIÓN).
3. Pantalla final con desglose completo y ranking regional.

### Guardado (más adelante)
Hoy: un slot en `localStorage` + export/import JSON. Próximo: varios slots locales. Supabase solo si hace falta
multi-dispositivo o ranking: interfaz `SaveBackend` (local | supabase) en `save.ts`, auth y tabla `partidas` con RLS.

---

## 7. Cómo seguir

Ver "Estado del proyecto". El próximo paso concreto está anotado al final de esta sección.

**Prompt sugerido para retomar en otra sesión** (pegarlo tal cual):
> Leé CLAUDE.md completo. Estamos en el proyecto "Simulador de Gobierno Sudamericano". Implementá la
> siguiente fase pendiente según la sección 6, respetando las convenciones de la sección 4 (motor puro,
> CFG único, RNG con semilla, tests y `npm run sim` con 400 partidas por estrategia). Al terminar: tests,
> sim, commit, actualizá el checklist de CLAUDE.md y resumí en ≤10 líneas. No arranques la fase siguiente sin OK.

**Próximo paso**: esperar OK del arquitecto. Si llega: Fase 5 (ciclo político: partida continua + elecciones),
sección 6, dejando el gancho para la Fase 6 (no entregar el poder al perder). Pendientes de decisión: ¿Brasil-belicista
79% es aceptable? Brasil-austeridad sigue en ~0% y "mandato gris" sigue siendo el final más común (con partida
continua el "gris" cambia de sentido: conviene recalibrar ahí).

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

- Fase 2: una sola votación por turno (ley O tratado) para que firmar tratados tenga costo de oportunidad.
- Beneficios de tratados con techo / no apilables (comercio con tope; integración y defensa cuentan una vez): sin
  eso, firmar con todos dominaba (Brasil integracionista ganaba 100%).
- Bono de gobernabilidad por ratificar (2) menor que por ley (6): se firman muchos más tratados que leyes.
- Brasil: tasa base 7→9 para que su problema (deuda cara) pese de verdad; antes era el país más fácil.
- La guerra NO existe en Fase 2: la crisis nivel 3 queda como gancho con mediación internacional.

- Fase 3: declarar ocupa la votación (prioridad guerra > tratado > ley); sin autorización se puede por decreto, con costo.
- El turno de la declaración no se combate (movilización); el combate arranca el turno siguiente.
- Piso de defensa aplicado en el motor (no se confía en la UI); el store lo refleja en el borrador.
- Avance por frente 12→7: con 12 las guerras duraban ~3 turnos; con 7, ~4 (objetivo 3–8).
- El prestigio regional del legado se mide contra `relacionesIniciales` (los datos), no contra `relacionesBase`,
  porque una guerra cambia la base con el ex enemigo.
- Perder una guerra no termina la partida: hunde indicadores y multiplica el riesgo de golpe (decisión del arquitecto).
- La guerra vive en la pestaña "Exterior" para no tener 6 pestañas en el celular.

- Malvinas (pedido del arquitecto): en disputa, administradas de facto por el RU, trama neutra. A futuro se podrá
  declarar la guerra al RU para recuperarlas (requiere un actor extrarregional). El Esequibo se dibuja como parte de
  Guyana (frontera de facto) sin marcar el reclamo venezolano.
- Fase 4: el mapa es dibujo propio low-poly (sin trazado oficial); Guayana Francesa se dibuja
  neutra porque no es uno de los 12. "Vecino" no se marca en el mapa (la geografía ya lo muestra; va en el aria-label).
- El mapa es solo UI + datos: no cambia el motor ni el balance. `situacionPais` vive en `engine/region.ts`.
- Roadmap reordenado tras jugar el MVP: Mapa → Ciclo político → Poder de facto → Eventos/IA reactiva → Herramientas → IA completa.
- **Cambio de premisa (arquitecto):** el juego no es pacifista; la guerra debe dar "una buena chance". Antes el objetivo
  era que `belicista` NO conviniera (0–10%); ahora, chances comparables a `equilibrada`. Igual con lo que venga
  (dictadura, etc.): todo jugable, nada dominante.
- Conquista permanente (decisión del arquitecto): armisticio congela la línea; el territorio da "bastante"; se puede
  devolver y reclamar. Solo entre vecinos por ahora.
- La gloria de una victoria escala con el rival (`CFG.guerra.gloria`): sin eso, Brasil-belicista llegaba a 83%.
- Unidades del mapa: propias en color de texto (contrastan sobre la franja de tu país), enemigas en rojo.
- Animaciones de unidades con SMIL (`animateMotion`/`animateTransform`): simples y sin JS por frame; como el CSS de
  `prefers-reduced-motion` no las frena, el componente no las renderiza en ese caso.

### Pendiente / no verificado
- Instalación de la PWA en un celular real (Android/iOS) — solo se puede verificar a mano.
