// Mapa esquemático de la región: color por relación, marcas de crisis/guerra, líneas de tratados y tensiones,
// cartel al pasar o enfocar un país y animaciones (respetan prefers-reduced-motion).
// Cada país es un botón accesible (Tab + Enter/Espacio); la lista de "Relaciones" sigue siendo la alternativa textual.
import { useState, type KeyboardEvent } from 'react';
import { MAPA_OTROS, MAPA_PAISES, MAPA_VIEWBOX } from '../../data/mapa';
import { nombrePais, situacionPais, type GameState, type SituacionPais } from '../../engine';
import { fmt } from '../format';
import { useGame } from '../store';
import { NOMBRE_TRATADO } from './AccionesPais';
import { CapaGuerra, CapaTerritorios } from './MapaGuerra';

const { ancho: W, alto: H } = MAPA_VIEWBOX;

/** Relleno según la relación: mezcla hacia verde (buena) o rojo (mala) sobre el color de la tierra. */
function relleno(sit: SituacionPais): string {
  if (sit.esJugador) return 'var(--color-brand)';
  const intensidad = Math.round((Math.min(100, Math.abs(sit.relacion)) / 100) * 70);
  const tono = sit.relacion >= 0 ? 'var(--color-good)' : 'var(--color-bad)';
  return `color-mix(in oklab, ${tono} ${intensidad}%, var(--color-map-land))`;
}

export function describirPais(sit: SituacionPais): string {
  if (sit.esJugador) return `${nombrePais(sit.id)} (tu país)`;
  const partes = [`${nombrePais(sit.id)}, relación ${fmt(sit.relacion, 0)}`];
  if (sit.vecino) partes.push('vecino');
  if (sit.guerra) partes.push('en guerra');
  if (sit.crisis) partes.push(`crisis de frontera nivel ${sit.crisis}`);
  if (sit.tratados.length) partes.push(`${sit.tratados.length} tratado/s`);
  if (sit.territorio > 0) partes.push(`administrás ${fmt(sit.territorio * 100, 0)}% de su franja fronteriza`);
  if (sit.territorio < 0) partes.push(`ocupa ${fmt(-sit.territorio * 100, 0)}% de tu franja fronteriza`);
  return partes.join(', ');
}

/** Curva suave entre dos puntos (arco hacia un costado) para las líneas de vínculo. */
function arco([x1, y1]: [number, number], [x2, y2]: [number, number]): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const k = 0.18;
  return `M${x1},${y1} Q${mx - (y2 - y1) * k},${my + (x2 - x1) * k} ${x2},${y2}`;
}

const signo = (n: number) => (n > 0 ? `+${fmt(n, 0)}` : fmt(n, 0));

interface Props {
  game: GameState;
  seleccionado?: string | null;
  /** Sin esto el mapa es solo de lectura (Panel, Final). */
  onSeleccionar?: (id: string) => void;
  compacto?: boolean;
}

export function MapaSudamerica({ game, seleccionado = null, onSeleccionar, compacto = false }: Props) {
  const previas = useGame((s) => s.relacionesPrevias);
  const [resaltado, setResaltado] = useState<string | null>(null);
  const interactivo = !!onSeleccionar;
  const ids = Object.keys(MAPA_PAISES);
  const situaciones = Object.fromEntries(ids.map((id) => [id, situacionPais(game, id)]));
  const propio = MAPA_PAISES[game.paisId]!.etiqueta;
  const conflictos = ids.filter((id) => situaciones[id]!.guerra || situaciones[id]!.crisis);
  const resumen = conflictos.length
    ? `Mapa de la región. Situaciones abiertas: ${conflictos.map((id) => describirPais(situaciones[id]!)).join('; ')}.`
    : 'Mapa de la región. Sin crisis ni guerras abiertas.';
  const delta = (id: string) => (previas && id in previas ? Math.round((game.relaciones[id] ?? 0) - previas[id]!) : 0);

  const teclado = (id: string) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSeleccionar?.(id);
    }
  };

  // Vínculos desde tu país: tratados (fluyen) y tensiones (crisis/guerra).
  const vinculos = ids
    .filter((id) => id !== game.paisId)
    .map((id) => ({ id, sit: situaciones[id]! }))
    .filter(({ sit }) => sit.guerra || sit.crisis || sit.tratados.length);

  return (
    <svg
      className={`mapa${compacto ? ' compacto' : ''}`}
      viewBox={`0 0 ${W} ${H}`}
      role={interactivo ? 'group' : 'img'}
      aria-label={resumen}
      onPointerLeave={() => setResaltado(null)}
    >
      <title>{resumen}</title>
      <defs>
        <linearGradient id="mapa-mar" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--color-map-sea)' }} />
          <stop offset="1" style={{ stopColor: 'var(--color-map-sea-2)' }} />
        </linearGradient>
        <pattern id="mapa-rayado-crisis" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" stroke="var(--color-warn)" strokeWidth="3" />
        </pattern>
        <pattern id="mapa-rayado-guerra" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="var(--color-bad)" strokeWidth="3" />
        </pattern>
        <pattern id="mapa-rayado-ocupado" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="white" strokeWidth="1.6" />
        </pattern>
        <pattern id="mapa-rayado-disputa" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="5" height="5" style={{ fill: 'var(--color-map-other)' }} />
          <line x1="0" y1="0" x2="0" y2="5" style={{ stroke: 'var(--color-map-line)' }} strokeWidth="1.6" />
        </pattern>
      </defs>

      {/* Mar con degradé y cuadrícula de meridianos/paralelos. */}
      <rect width={W} height={H} fill="url(#mapa-mar)" />
      <g className="mapa-grilla" aria-hidden="true">
        {[75, 150, 225, 300, 375].map((x) => (
          <line key={`x${x}`} x1={x} y1={0} x2={x} y2={H} />
        ))}
        {[75, 150, 225, 300, 375, 450, 525, 600].map((y) => (
          <line key={`y${y}`} x1={0} y1={y} x2={W} y2={y} />
        ))}
      </g>

      <g className="mapa-tierra">
        {MAPA_OTROS.map((t) => (
          <g key={t.id} className={`mapa-otro${t.disputa ? ' disputa' : ''}`} role="img" aria-label={t.disputa ? `${t.nombre}. ${t.disputa.nota}` : t.nombre}>
            <title>{t.disputa ? `${t.nombre}. ${t.disputa.nota}` : t.nombre}</title>
            <path d={t.d} fill={t.disputa ? 'url(#mapa-rayado-disputa)' : undefined} />
          </g>
        ))}

        {ids.map((id, i) => {
          const f = MAPA_PAISES[id]!;
          const sit = situaciones[id]!;
          const marca = sit.guerra ? 'url(#mapa-rayado-guerra)' : sit.crisis ? 'url(#mapa-rayado-crisis)' : null;
          return (
            <g
              key={id}
              className={`mapa-pais${sit.guerra ? ' guerra' : sit.crisis ? ' crisis' : ''}`}
              style={{ ['--i' as string]: i }}
              {...(interactivo
                ? {
                    role: 'button',
                    tabIndex: 0,
                    'aria-label': describirPais(sit),
                    'aria-pressed': seleccionado === id,
                    onClick: () => onSeleccionar(id),
                    onKeyDown: teclado(id),
                    onPointerEnter: () => setResaltado(id),
                    onFocus: () => setResaltado(id),
                    onBlur: () => setResaltado((r) => (r === id ? null : r)),
                  }
                : { 'aria-hidden': true })}
            >
              <path d={f.d} className="forma" style={{ fill: relleno(sit) }} />
              {marca && <path d={f.d} fill={marca} className="marca" />}
            </g>
          );
        })}
      </g>

      <CapaTerritorios game={game} />
      <CapaGuerra game={game} compacto={compacto} />

      {/* Resaltado (hover/foco) y seleccionado, redibujados arriba para que no los tapen los vecinos. */}
      {resaltado && resaltado !== seleccionado && <path d={MAPA_PAISES[resaltado]!.d} className="mapa-resaltado" aria-hidden="true" />}
      {seleccionado && MAPA_PAISES[seleccionado] && (
        <g aria-hidden="true">
          <path d={MAPA_PAISES[seleccionado].d} className="mapa-sel-fondo" />
          <path d={MAPA_PAISES[seleccionado].d} className="mapa-sel-hormigas" />
        </g>
      )}

      <g className="mapa-vinculos" aria-hidden="true">
        {vinculos.map(({ id, sit }) => (
          <path key={id} d={arco(propio, MAPA_PAISES[id]!.etiqueta)} className={`vinculo ${sit.guerra ? 'guerra' : sit.crisis ? 'crisis' : 'tratado'}`} />
        ))}
      </g>

      {/* Etiquetas, pulsos y cambios de relación (no capturan el puntero). */}
      <g className="mapa-etiquetas" aria-hidden="true">
        {MAPA_OTROS.filter((t) => t.disputa && !compacto).map((t) => (
          <text key={t.id} x={t.disputa!.etiqueta[0]} y={t.disputa!.etiqueta[1]} className="etiqueta-otro">
            {t.disputa!.abrev} · en disputa
          </text>
        ))}
        {ids.map((id) => {
          const f = MAPA_PAISES[id]!;
          const sit = situaciones[id]!;
          const [lx, ly] = f.etiqueta;
          const d = compacto ? 0 : delta(id);
          return (
            <g key={id}>
              {(sit.guerra || sit.crisis) && <circle cx={lx} cy={ly} r={14} className={`pulso${sit.guerra ? ' guerra' : ''}`} />}
              <text x={lx} y={ly} className={`etiqueta${sit.esJugador ? ' propia' : ''}`}>
                {sit.esJugador ? 'VOS' : f.abrev}
              </text>
              {!compacto && (sit.guerra || sit.crisis) && (
                <text x={lx} y={ly + 13} className="etiqueta detalle">
                  {sit.guerra ? 'guerra' : `crisis ${sit.crisis}/3`}
                </text>
              )}
              {sit.tratados.map((t, i) => (
                <circle key={t} cx={lx - (sit.tratados.length - 1) * 4 + i * 8} cy={ly - 15} r={3} className="tratado" />
              ))}
              {d !== 0 && (
                <text x={lx + 18} y={ly - 4} className={`delta ${d > 0 ? 'sube' : 'baja'}`}>
                  {signo(d)}
                </text>
              )}
            </g>
          );
        })}
      </g>

      {/* Áreas táctiles mínimas para los países chicos. */}
      {interactivo &&
        ids.map((id) => {
          const [lx, ly] = MAPA_PAISES[id]!.etiqueta;
          return <circle key={id} cx={lx} cy={ly} r={22} className="mapa-tactil" aria-hidden="true" onClick={() => onSeleccionar(id)} onPointerEnter={() => setResaltado(id)} />;
        })}

      {interactivo && resaltado && <Cartel sit={situaciones[resaltado]!} delta={delta(resaltado)} />}
    </svg>
  );
}

/** Cartel flotante dentro del SVG (escala con el mapa; no depende de coordenadas de pantalla). */
function Cartel({ sit, delta }: { sit: SituacionPais; delta: number }) {
  const [lx, ly] = MAPA_PAISES[sit.id]!.etiqueta;
  const estado = sit.guerra
    ? 'En guerra'
    : sit.territorio > 0
      ? `Administrás ${fmt(sit.territorio * 100, 0)}% de su franja`
      : sit.territorio < 0
        ? `Ocupa ${fmt(-sit.territorio * 100, 0)}% de tu franja`
    : sit.crisis
      ? `Crisis de frontera ${sit.crisis}/3`
      : sit.tratados.length
        ? `Tratados: ${sit.tratados.map((t) => NOMBRE_TRATADO[t]).join(', ')}`
        : sit.vecino
          ? 'Vecino · sin tratados'
          : 'Sin tratados';
  const lineas = sit.esJugador
    ? [nombrePais(sit.id), 'Tu país', `Capacidad militar ${fmt(sit.capacidad, 0)}`]
    : [nombrePais(sit.id), `Relación ${fmt(sit.relacion, 0)}${delta ? ` (${signo(delta)} este trimestre)` : ''}`, estado];
  const ancho = Math.max(...lineas.map((l, i) => l.length * (i === 0 ? 8.5 : 6.8))) + 22;
  const alto = 14 + lineas.length * 17;
  const x = Math.min(Math.max(lx - ancho / 2, 6), W - ancho - 6);
  const y = ly - alto - 24 < 6 ? ly + 24 : ly - alto - 24;
  return (
    <g className="mapa-cartel" aria-hidden="true" transform={`translate(${x},${y})`}>
      <rect width={ancho} height={alto} rx={8} />
      {lineas.map((l, i) => (
        <text key={i} x={11} y={21 + i * 17} className={i === 0 ? 'titulo' : sit.guerra && i === 2 ? 'malo' : undefined}>
          {l}
        </text>
      ))}
    </g>
  );
}

/** Leyenda en HTML (fuera del SVG, para que se lea bien con lector de pantalla). */
export function LeyendaMapa() {
  return (
    <ul className="mapa-leyenda small" aria-label="Referencias del mapa">
      <li>
        <span className="muestra" style={{ background: 'var(--color-brand)' }} /> Tu país
      </li>
      <li>
        <span className="muestra" style={{ background: 'color-mix(in oklab, var(--color-good) 70%, var(--color-map-land))' }} /> Buena relación
      </li>
      <li>
        <span className="muestra" style={{ background: 'color-mix(in oklab, var(--color-bad) 70%, var(--color-map-land))' }} /> Mala relación
      </li>
      <li>
        <span className="muestra rayada crisis" /> Crisis de frontera
      </li>
      <li>
        <span className="muestra rayada guerra" /> Guerra
      </li>
      <li>
        <span className="muestra rayada disputa" /> Territorio en disputa
      </li>
      <li>
        <span className="muestra punto" /> Tratado (uno por tratado)
      </li>
      <li>
        <span className="muestra linea" /> Vínculo de tratado
      </li>
      <li>
        <span className="muestra linea tension" /> Tensión
      </li>
      <li>
        <span className="muestra rayada ocupado" /> Territorio ocupado / línea del frente
      </li>
    </ul>
  );
}
