// Tarjeta del conflicto activo: estado, reparto de esfuerzo y armisticio. Tono sobrio.
import { CFG } from '../../data/config';
import {
  capacidadPropia,
  esVecino,
  DESTINOS,
  esfuerzoPorDefecto,
  frentesDisponibles,
  nombrePais,
  normalizarEsfuerzo,
  probArmisticio,
  type DestinoEsfuerzo,
  type Esfuerzo,
  type FrenteMilitar,
} from '../../engine';
import { fmt } from '../format';
import { useGame } from '../store';
import { Bar } from './Bar';

const NOMBRE_DESTINO: Record<DestinoEsfuerzo, string> = {
  aire: 'Frente aéreo',
  mar: 'Frente naval',
  frontera: 'Frente terrestre',
  economia: 'Economía (sostener el frente interno)',
  diplomacia: 'Diplomacia (buscar mediación)',
};

const MOTIVO_SIN_FRENTE: Record<FrenteMilitar, string> = {
  aire: '',
  mar: 'Sin costa compartida: no hay frente naval.',
  frontera: 'No son vecinos: no hay frente terrestre.',
};

export function GuerraCard({ compacta = false }: { compacta?: boolean }) {
  const game = useGame((s) => s.game)!;
  const draft = useGame((s) => s.draft)!;
  const setDraft = useGame((s) => s.setDraft);
  const irA = useGame((s) => s.irA);
  const g = game.guerra;
  if (!g) return null;
  const frentes = frentesDisponibles(game.paisId, g.contra);
  const crudo: Esfuerzo = draft.guerra.esfuerzo ?? esfuerzoPorDefecto(frentes);
  const normal = normalizarEsfuerzo(crudo, frentes);
  const setEsfuerzo = (k: DestinoEsfuerzo, v: number) => setDraft({ guerra: { ...draft.guerra, esfuerzo: { ...crudo, [k]: v } } });
  const enemigo = nombrePais(g.contra);
  const combate = game.turno > g.desde;

  return (
    <section className="card stack" style={{ borderColor: 'var(--color-text)', borderWidth: 2 }} aria-labelledby="guerra-titulo">
      <h2 id="guerra-titulo">
        Conflicto armado con {enemigo} {g.defensiva ? '(defensivo)' : ''}
      </h2>
      <p className="small muted">
        {g.turnos} trimestre/s de combate · {g.autorizada ? 'con autorización del Congreso' : 'sin autorización del Congreso'} · fuerzas propias{' '}
        {fmt(capacidadPropia(game), 0)} vs. {fmt(g.capacidadEnemiga, 0)}
      </p>
      <div className="stack" style={{ gap: 4 }}>
        <div className="row spread small">
          <span>Situación en el terreno</span>
          <span>{g.avance >= 0 ? `+${fmt(g.avance, 0)}` : fmt(g.avance, 0)} (±{CFG.guerra.umbralVictoria} define)</span>
        </div>
        <Bar value={g.avance + 100} max={200} label="Situación en el terreno" color={g.avance >= 0 ? 'var(--color-good)' : 'var(--color-bad)'} />
        <p className="small muted" style={{ margin: 0 }}>
          {esVecino(game.paisId, g.contra)
            ? `Territorio en juego. Con un armisticio hoy, la línea se congela en ${fmt(Math.min(100, (Math.abs(g.avance) / CFG.guerra.umbralVictoria) * 100), 0)}% de la franja ${g.avance >= 0 ? 'a tu favor' : 'en tu contra'}; la victoria da la franja plena.`
            : 'Sin frontera común: no se disputa territorio.'}
        </p>
        <div className="row spread small">
          <span>Presión internacional</span>
          <span>{fmt(g.presion, 0)}/100 (en 100 se impone el cese del fuego)</span>
        </div>
        <Bar value={g.presion} label="Presión internacional" color="var(--color-warn)" />
        <div className="row spread small">
          <span>Costo humano</span>
          <span>{fmt(g.costoHumano, 0)}/100</span>
        </div>
        <Bar value={g.costoHumano} label="Costo humano" color="var(--color-text)" />
      </div>

      {compacta ? (
        <button type="button" onClick={() => irA('diplomacia')}>
          Conducir el conflicto
        </button>
      ) : (
        <>
          <fieldset className="stack">
            <legend>Reparto del esfuerzo {combate ? 'de este trimestre' : '(desde el próximo trimestre)'}</legend>
            <p className="small muted">Mové los controles: el reparto se normaliza para sumar 100%.</p>
            {DESTINOS.map((k) => {
              const habilitado = !(['aire', 'mar', 'frontera'] as string[]).includes(k) || frentes.includes(k as FrenteMilitar);
              return (
                <div key={k} className="stack" style={{ gap: 2 }}>
                  <div className="row spread small">
                    <label htmlFor={`esf-${k}`}>{NOMBRE_DESTINO[k]}</label>
                    <span>{habilitado ? `${fmt(normal[k], 0)}%` : '—'}</span>
                  </div>
                  <input
                    id={`esf-${k}`}
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={habilitado ? crudo[k] : 0}
                    disabled={!habilitado}
                    onChange={(e) => setEsfuerzo(k, Number(e.target.value))}
                    aria-describedby={habilitado ? undefined : `esf-${k}-motivo`}
                  />
                  {!habilitado && (
                    <span id={`esf-${k}-motivo`} className="small muted">
                      {MOTIVO_SIN_FRENTE[k as FrenteMilitar]}
                    </span>
                  )}
                </div>
              );
            })}
          </fieldset>
          <label className="option">
            <input
              type="checkbox"
              checked={draft.guerra.armisticio}
              disabled={!combate}
              onChange={(e) => setDraft({ guerra: { ...draft.guerra, armisticio: e.target.checked } })}
            />
            <span>
              <strong>Proponer armisticio este trimestre</strong>
              <br />
              <span className="small muted">Chance estimada de que se acepte: {fmt(probArmisticio(game, normal) * 100, 0)}%.</span>
            </span>
          </label>
        </>
      )}
    </section>
  );
}
