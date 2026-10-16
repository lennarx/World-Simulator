import { useState } from 'react';
import { CFG } from '../../data/config';
import {
  esVecino,
  nombrePais,
  otrosPaises,
  puedeFirmar,
  TIPOS_TRATADO,
  votosTratado,
  type AccionDiplomatica,
  type RespuestaCrisis,
  type TipoAccion,
  type TipoTratado,
} from '../../engine';
import { Bar } from '../components/Bar';
import { DeclararGuerraDialog } from '../components/DeclararGuerraDialog';
import { GuerraCard } from '../components/GuerraCard';
import { fmt } from '../format';
import { useGame } from '../store';

const ACCIONES: { tipo: TipoAccion; label: string; ayuda: string }[] = [
  { tipo: 'visita', label: 'Visita', ayuda: 'Mejora la relación (rinde menos si ya es buena).' },
  { tipo: 'cooperacion', label: 'Cooperar', ayuda: 'Seguridad conjunta: relación y algo de estabilidad. Requiere relación ≥ 0.' },
  { tipo: 'protesta', label: 'Protestar', ayuda: 'Baja la relación. En plena crisis con ese país, suma aprobación.' },
  { tipo: 'gesto', label: 'Gesto', ayuda: 'Discurso duro: sube tu aprobación, baja la relación.' },
];

export const NOMBRE_TRATADO: Record<TipoTratado, string> = {
  comercio: 'Comercio',
  defensa: 'Defensa',
  integracion: 'Integración',
};

const AYUDA_TRATADO: Record<TipoTratado, string> = {
  comercio: `Crecimiento y reservas según el peso comercial del socio (con techo). Relación mínima ${CFG.diplomacia.tratados.comercio.relacionMin}.`,
  defensa: `Más capacidad militar y escalar crisis con terceros cuesta menos. Relación mínima ${CFG.diplomacia.tratados.defensa.relacionMin}.`,
  integracion: `Baja la prima y suma crecimiento, pero exige no emitir y déficit ≤ ${CFG.diplomacia.tratados.integracion.deficitMax}%. Relación mínima ${CFG.diplomacia.tratados.integracion.relacionMin}.`,
};

const RESPUESTAS: { r: RespuestaCrisis; label: string; ayuda: string }[] = [
  { r: 'negociar', label: 'Negociar', ayuda: 'Baja la tensión y mejora la relación. Algo de costo en aprobación.' },
  { r: 'escalar', label: 'Endurecer la postura', ayuda: 'Rally de aprobación, pero sube la tensión y pegan reservas, crecimiento y prima.' },
  { r: 'ignorar', label: 'Dejar pasar', ayuda: 'La crisis sigue y erosiona la estabilidad.' },
];

export function Diplomacia() {
  const game = useGame((s) => s.game)!;
  const draft = useGame((s) => s.draft)!;
  const setDraft = useGame((s) => s.setDraft);
  const paises = otrosPaises(game.paisId);
  const [tipoTratado, setTipoTratado] = useState<TipoTratado>('comercio');
  const [dialogoGuerra, setDialogoGuerra] = useState<string | null>(null);
  const declaracion = draft.guerra.declarar;
  const max = CFG.diplomacia.accionesPorTurno;
  const usadas = draft.diplomacia.length;

  const sumarAccion = (a: AccionDiplomatica) => {
    if (usadas >= max) return;
    setDraft({ diplomacia: [...draft.diplomacia, a] });
  };
  const quitarAccion = (i: number) => setDraft({ diplomacia: draft.diplomacia.filter((_, j) => j !== i) });

  const votos = draft.tratado ? votosTratado(game, draft.tratado.tipo, draft.concesiones) : null;
  const crisis = game.crisis;

  return (
    <main className="stack">
      <GuerraCard />
      {declaracion && (
        <section className="card stack" style={{ borderColor: 'var(--color-bad)' }} aria-live="polite">
          <p>
            <strong className="bad">Declaración de guerra a {nombrePais(declaracion)} incluida en este trimestre.</strong> Se votará en el Congreso al cerrar el
            trimestre ({draft.guerra.siRechaza === 'avanzar' ? 'si la rechaza, se avanza por decreto' : 'si la rechaza, se desiste'}).
          </p>
          <button type="button" onClick={() => setDraft({ guerra: { ...draft.guerra, declarar: null } })}>
            Retirar la declaración
          </button>
        </section>
      )}
      {crisis && (
        <section className="card stack" style={{ borderColor: 'var(--color-bad)' }} aria-labelledby="crisis-titulo">
          <h2 id="crisis-titulo" className="bad">
            Crisis de frontera con {nombrePais(crisis.con)} · nivel {crisis.nivel}/3
          </h2>
          <p className="small muted">
            Lleva {crisis.turnos} trimestre/s. Mientras dure, cuesta reservas, crecimiento y estabilidad (más cuanto mayor el nivel).
          </p>
          <div role="radiogroup" aria-label="Respuesta a la crisis" className="stack" style={{ gap: 0 }}>
            {RESPUESTAS.map(({ r, label, ayuda }) => (
              <label key={r} className="option">
                <input
                  type="radio"
                  name="crisis"
                  checked={(draft.respuestaCrisis ?? 'ignorar') === r}
                  onChange={() => setDraft({ respuestaCrisis: r })}
                />
                <span>
                  <strong>{label}</strong>
                  <br />
                  <span className="small muted">{ayuda}</span>
                </span>
              </label>
            ))}
          </div>
        </section>
      )}

      <section className="card stack" aria-labelledby="acciones-titulo">
        <h2 id="acciones-titulo">
          Acciones del trimestre ({usadas}/{max})
        </h2>
        {usadas === 0 ? (
          <p className="small muted">Elegí acciones desde la lista de países.</p>
        ) : (
          <ul className="stack" style={{ margin: 0, paddingLeft: 18 }}>
            {draft.diplomacia.map((a, i) => (
              <li key={i} className="row spread">
                <span>
                  {ACCIONES.find((x) => x.tipo === a.tipo)?.label} · {nombrePais(a.con)}
                </span>
                <button type="button" className="ghost" onClick={() => quitarAccion(i)} aria-label={`Quitar ${a.tipo} con ${nombrePais(a.con)}`}>
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card stack" aria-labelledby="tratado-titulo">
        <h2 id="tratado-titulo">Proponer tratado</h2>
        <p className="small muted">Se vota en el Congreso y ocupa la votación del trimestre (reemplaza a la ley).</p>
        <div role="radiogroup" aria-label="Tipo de tratado" className="stack" style={{ gap: 0 }}>
          {TIPOS_TRATADO.map((t) => (
            <label key={t} className="option">
              <input type="radio" name="tipoTratado" checked={tipoTratado === t} onChange={() => setTipoTratado(t)} />
              <span>
                <strong>{NOMBRE_TRATADO[t]}</strong>
                <br />
                <span className="small muted">{AYUDA_TRATADO[t]}</span>
              </span>
            </label>
          ))}
        </div>
        {draft.tratado ? (
          <div className="stack">
            <p>
              Propuesto: <strong>{NOMBRE_TRATADO[draft.tratado.tipo]}</strong> con <strong>{nombrePais(draft.tratado.con)}</strong>.
            </p>
            {votos && (
              <p aria-live="polite">
                Votos esperados: <strong className={votos.si / votos.total > 0.5 ? 'good' : 'bad'}>{fmt(votos.si, 0)}</strong> de {votos.total}. Las concesiones del Congreso
                también cuentan.
              </p>
            )}
            <button type="button" onClick={() => setDraft({ tratado: null })}>
              Retirar propuesta
            </button>
          </div>
        ) : (
          <p className="small muted">Tocá "Proponer" en un país de la lista.</p>
        )}
      </section>

      <section className="stack" aria-labelledby="paises-titulo">
        <h2 id="paises-titulo">Relaciones</h2>
        {paises.map((id) => {
          const rel = game.relaciones[id] ?? 0;
          const tratados = game.tratados.filter((t) => t.con === id);
          const firma = puedeFirmar(game, tipoTratado, id);
          return (
            <article key={id} className="card stack" style={{ gap: 6 }} aria-label={`${nombrePais(id)}, relación ${fmt(rel, 0)}`}>
              <div className="row spread">
                <strong>
                  {nombrePais(id)} {esVecino(game.paisId, id) && <span className="chip">VECINO</span>}{' '}
                  {crisis?.con === id && <span className="chip" style={{ color: 'var(--color-bad)', borderColor: 'var(--color-bad)' }}>CRISIS</span>}
                </strong>
                <span className={rel >= 0 ? 'good' : 'bad'}>{fmt(rel, 0)}</span>
              </div>
              <Bar value={rel + 100} max={200} label={`Relación con ${nombrePais(id)}`} color={rel >= 0 ? 'var(--color-good)' : 'var(--color-bad)'} />
              {tratados.length > 0 && (
                <div className="row small">
                  {tratados.map((t) => (
                    <span key={t.tipo} className="chip">
                      {NOMBRE_TRATADO[t.tipo].toUpperCase()}
                    </span>
                  ))}
                </div>
              )}
              <div className="row small" style={{ gap: 6 }}>
                {ACCIONES.map((a) => (
                  <button
                    key={a.tipo}
                    type="button"
                    title={a.ayuda}
                    disabled={usadas >= max}
                    onClick={() => sumarAccion({ tipo: a.tipo, con: id })}
                    aria-label={`${a.label} con ${nombrePais(id)}. ${a.ayuda}`}
                  >
                    {a.label}
                  </button>
                ))}
                <button
                  type="button"
                  className="primary"
                  disabled={!firma.ok}
                  title={firma.ok ? `Proponer ${NOMBRE_TRATADO[tipoTratado]}` : firma.motivo}
                  aria-label={firma.ok ? `Proponer tratado de ${NOMBRE_TRATADO[tipoTratado]} con ${nombrePais(id)}` : `No se puede proponer: ${firma.motivo}`}
                  onClick={() => setDraft({ tratado: { tipo: tipoTratado, con: id }, ley: null, guerra: { ...draft.guerra, declarar: null } })}
                >
                  Proponer
                </button>
                <button
                  type="button"
                  disabled={!!game.guerra || !!declaracion}
                  onClick={() => setDialogoGuerra(id)}
                  aria-label={`Declarar la guerra a ${nombrePais(id)}…`}
                  title={game.guerra ? 'Ya hay un conflicto en curso.' : undefined}
                  style={{ color: 'var(--color-bad)' }}
                >
                  Declarar guerra…
                </button>
              </div>
            </article>
          );
        })}
      </section>
      <DeclararGuerraDialog contra={dialogoGuerra} onClose={() => setDialogoGuerra(null)} />
    </main>
  );
}
