// Capas de guerra del mapa: territorio ocupado (permanente), franja móvil de la guerra en curso y unidades esquemáticas
// (tanques, aviones, barcos) con destellos SOLO sobre la línea del frente. Regla de tono: nada sobre ciudades ni
// población; siluetas abstractas. Con prefers-reduced-motion todo queda quieto.
import { useEffect, useState } from 'react';
import { CFG } from '../../data/config';
import { centroDe, costaDe, FRANJA_MAX, fronteraEntre, MAPA_PAISES, polilinea, puntosSobre } from '../../data/mapa';
import { frentesDisponibles, type GameState } from '../../engine';
import { useGame } from '../store';

type P = [number, number];

const unit = ([x, y]: P): P => {
  const n = Math.hypot(x, y) || 1;
  return [x / n, y / n];
};
const resta = (a: P, b: P): P => [a[0] - b[0], a[1] - b[1]];
const suma = (a: P, b: P, k = 1): P => [a[0] + b[0] * k, a[1] + b[1] * k];
const grados = ([x, y]: P) => (Math.atan2(y, x) * 180) / Math.PI;

function useMovimientoReducido(): boolean {
  const [r, setR] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const f = () => setR(mq.matches);
    mq.addEventListener?.('change', f);
    return () => mq.removeEventListener?.('change', f);
  }, []);
  return r;
}

/** Franja sobre `de` a lo largo de la frontera con `otro`, de `ancho` unidades. Recortada al territorio de `de`. */
function Franja({ de, otro, ancho, color, clase }: { de: string; otro: string; ancho: number; color: string; clase: string }) {
  const linea = fronteraEntre(de, otro);
  if (!linea || ancho <= 0.5) return null;
  const d = polilinea(linea);
  const id = `clip-${clase}-${de}-${otro}`;
  return (
    <g className={`mapa-franja ${clase}`} aria-hidden="true">
      <clipPath id={id}>
        <path d={MAPA_PAISES[de]!.d} />
      </clipPath>
      <g clipPath={`url(#${id})`}>
        {/* El trazo de afuera, un poco más ancho, queda como la nueva línea de hecho. */}
        <path d={d} className="borde" style={{ strokeWidth: ancho * 2 + 3 }} />
        <path d={d} className="relleno" style={{ strokeWidth: ancho * 2, stroke: color }} />
        <path d={d} className="trama" style={{ strokeWidth: ancho * 2 }} />
      </g>
    </g>
  );
}

const colorDe = (game: GameState, ocupante: string) =>
  ocupante === game.paisId ? 'var(--color-brand)' : 'color-mix(in oklab, var(--color-bad) 80%, var(--color-map-land))';

/** Territorio que quedó de guerras pasadas. */
export function CapaTerritorios({ game }: { game: GameState }) {
  return (
    <g className="mapa-territorios">
      {game.territorios.map((t) => (
        <Franja key={`${t.ocupante}-${t.de}`} de={t.de} otro={t.ocupante} ancho={t.profundidad * FRANJA_MAX} color={colorDe(game, t.ocupante)} clase="permanente" />
      ))}
    </g>
  );
}

// ---------------------------------------------------------------- Siluetas (originales, sin detalle)

const ESCALA_UNIDAD = 1.5;

function Tanque({ color }: { color: string }) {
  return (
    <g className="unidad tanque" style={{ fill: color }} transform={`scale(${ESCALA_UNIDAD})`}>
      <rect x={-8} y={-3.5} width={16} height={7} rx={2} />
      <rect x={-3.5} y={-2.5} width={7} height={5} rx={1.5} className="torreta" />
      <rect x={3} y={-0.8} width={8} height={1.6} />
    </g>
  );
}

function Avion({ color }: { color: string }) {
  // Apunta hacia +x (para animateMotion con rotate="auto").
  return (
    <path
      className="unidad avion"
      style={{ fill: color }}
      transform={`scale(${ESCALA_UNIDAD})`}
      d="M9,0 L3,-1.6 L-1,-8 L-3.5,-8 L-1.2,-1.6 L-6,-1.4 L-8,-4 L-9.5,-4 L-8.4,0 L-9.5,4 L-8,4 L-6,1.4 L-1.2,1.6 L-3.5,8 L-1,8 L3,1.6 Z"
    />
  );
}

function Barco({ color }: { color: string }) {
  return (
    <g className="unidad barco" style={{ fill: color }} transform={`scale(${ESCALA_UNIDAD})`}>
      <path d="M-10,0 L10,0 L7,4 L-7,4 Z" />
      <rect x={-4} y={-4} width={7} height={4} rx={1} />
      <rect x={-1} y={-7} width={2} height={3} />
    </g>
  );
}

// ---------------------------------------------------------------- Guerra en curso

/**
 * Franja móvil + unidades. `compacto`: solo la franja (Panel). La franja crece/achica desde el avance del trimestre
 * anterior (animación CSS de stroke-width).
 */
export function CapaGuerra({ game, compacto = false }: { game: GameState; compacto?: boolean }) {
  const previa = useGame((s) => s.guerraPrevia);
  const reducido = useMovimientoReducido();
  const g = game.guerra;
  const objetivo = g ? (Math.min(1, Math.abs(g.avance) / CFG.guerra.umbralVictoria) * FRANJA_MAX) : 0;
  const inicial = g && previa?.contra === g.contra ? Math.min(1, Math.abs(previa.avance) / CFG.guerra.umbralVictoria) * FRANJA_MAX : objetivo;
  // Si el signo cambió (el frente cruzó la frontera), arrancamos de cero en el lado nuevo.
  const mismoLado = !g || !previa || previa.contra !== g.contra || Math.sign(previa.avance) === Math.sign(g.avance) || previa.avance === 0;
  const [ancho, setAncho] = useState(reducido ? objetivo : mismoLado ? inicial : 0);
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setAncho(objetivo)));
    return () => cancelAnimationFrame(id);
  }, [objetivo]);

  if (!g) return null;
  const yo = game.paisId;
  const el = g.contra;
  const frentes = frentesDisponibles(yo, el);
  const linea = fronteraEntre(yo, el);
  const ganando = g.avance >= 0;
  // La franja va sobre el territorio que se está perdiendo.
  const [ocupado, ocupante] = ganando ? [el, yo] : [yo, el];
  const combate = game.turno > g.desde;
  // Unidades propias en el color de texto: contrastan con la franja (que va en el color de tu país).
  const colorPropio = 'var(--color-text)';
  const colorEnemigo = 'var(--color-bad)';

  const franja = linea && <Franja de={ocupado} otro={ocupante} ancho={ancho} color={colorDe(game, ocupante)} clase="frente" />;
  if (compacto) return <g className="mapa-guerra">{franja}</g>;

  // Línea del frente: puntos de la frontera desplazados hacia el lado ocupado según el ancho de la franja.
  const centroOcupado = centroDe(ocupado);
  const puntosFrente: P[] = linea ? puntosSobre(linea, 5).map((p) => suma(p, unit(resta(centroOcupado, p)), ancho * 0.85)) : [];

  // Quién empuja en cada frente (último resultado). Antes del primer combate, las fuerzas propias se despliegan.
  const lado = (f: 'aire' | 'mar' | 'frontera') => (g.ultimosFrentes[f] === 'perdido' ? 'enemigo' : 'propio');

  // ---- Tanques (frente terrestre)
  const tanques =
    linea && frentes.includes('frontera')
      ? puntosSobre(linea, 3).map((p, i) => {
          const atacante = lado('frontera');
          const destino = atacante === 'propio' ? el : yo;
          const dir = unit(resta(centroDe(destino), p));
          const base = suma(p, dir, ganando === (atacante === 'propio') ? ancho * 0.6 : -4);
          const fin = suma(base, dir, 10);
          return { i, base, fin, ang: grados(dir), color: atacante === 'propio' ? colorPropio : colorEnemigo };
        })
      : [];

  // ---- Aviones (siempre): del atacante hacia la zona del frente (o hacia el rival si no hay frontera).
  const atacanteAire = lado('aire');
  const origenAire = MAPA_PAISES[atacanteAire === 'propio' ? yo : el]!.etiqueta;
  const blancoAire: P = puntosFrente[2] ?? suma(origenAire, resta(centroDe(atacanteAire === 'propio' ? el : yo), origenAire), 0.7);
  const curva = (a: P, b: P, k: number) => {
    const m: P = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const n: P = [-(b[1] - a[1]) * k, (b[0] - a[0]) * k];
    return `M${a.join(',')} Q${suma(m, n).join(',')} ${b.join(',')}`;
  };
  const rutasAire = [curva(origenAire, blancoAire, 0.25), curva(origenAire, blancoAire, -0.2)];

  // ---- Barcos (si hay frente naval): frente a la costa del que va perdiendo en el mar.
  let barcos: { pos: P; tang: P; color: string }[] = [];
  if (frentes.includes('mar')) {
    const atacante = lado('mar');
    const bloqueado = atacante === 'propio' ? el : yo;
    const costa = costaDe(bloqueado);
    if (costa.length) {
      const ref = puntosFrente[2] ?? centroDe(atacante === 'propio' ? yo : el);
      const masCerca = costa.reduce((m, p) => (Math.hypot(p[0] - ref[0], p[1] - ref[1]) < Math.hypot(m[0] - ref[0], m[1] - ref[1]) ? p : m));
      // Mar afuera = desde el frente hacia la costa y más allá (el centro del país no sirve: en países anchos queda cerca de la costa).
      const afuera = unit(resta(masCerca, ref));
      const tang: P = [-afuera[1], afuera[0]];
      barcos = [-12, 12].map((k) => ({ pos: suma(suma(masCerca, afuera, 22), tang, k), tang, color: atacante === 'propio' ? colorPropio : colorEnemigo }));
    }
  }

  return (
    <g className="mapa-guerra" aria-hidden="true">
      {franja}
      {combate && (
        <g className="destellos">
          {puntosFrente.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={5} className="destello" style={{ animationDelay: `${i * 0.37}s` }} />
          ))}
        </g>
      )}
      {tanques.map((t) => (
        <g key={t.i} transform={`translate(${t.base.join(',')})`}>
          <g transform={`rotate(${t.ang})`}>
            {!reducido && combate && (
              <animateTransform
                attributeName="transform"
                type="translate"
                values={`0,0; 8,0; 0,0`}
                dur={`${2.4 + t.i * 0.3}s`}
                repeatCount="indefinite"
                additive="sum"
              />
            )}
            <Tanque color={t.color} />
          </g>
        </g>
      ))}
      {rutasAire.map((r, i) =>
        reducido || !combate ? (
          i === 0 && (
            <g key={i} transform={`translate(${origenAire.join(',')}) rotate(${grados(resta(blancoAire, origenAire))})`}>
              <Avion color={atacanteAire === 'propio' ? colorPropio : colorEnemigo} />
            </g>
          )
        ) : (
          <g key={i}>
            <path d={r} className="ruta-aerea" />
            <g>
              <animateMotion path={r} dur="2.8s" begin={`${i * 1.4}s`} repeatCount="indefinite" rotate="auto" />
              <Avion color={atacanteAire === 'propio' ? colorPropio : colorEnemigo} />
            </g>
          </g>
        ),
      )}
      {barcos.map((b, i) => (
        <g key={i} transform={`translate(${b.pos.join(',')})`}>
          {!reducido && combate && (
            <animateTransform
              attributeName="transform"
              type="translate"
              values={`0,0; ${b.tang[0] * 6},${b.tang[1] * 6}; 0,0`}
              dur={`${4 + i}s`}
              repeatCount="indefinite"
              additive="sum"
            />
          )}
          <Barco color={b.color} />
        </g>
      ))}
    </g>
  );
}
