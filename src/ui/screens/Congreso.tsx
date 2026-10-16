import { CFG } from '../../data/config';
import { LEYES, getLey, votosEsperados, type TipoBloque } from '../../engine';
import { Bar } from '../components/Bar';
import { fmt } from '../format';
import { useGame } from '../store';

const TIPO: Record<TipoBloque, string> = {
  oficialismo: 'Oficialismo',
  aliado: 'Aliado',
  centro: 'Centro',
  opositor: 'Oposición',
  regional: 'Regional',
};

export function Congreso() {
  const game = useGame((s) => s.game)!;
  const draft = useGame((s) => s.draft)!;
  const setDraft = useGame((s) => s.setDraft);
  const total = game.congreso.reduce((a, b) => a + b.bancas, 0);
  const ley = draft.ley ? getLey(draft.ley) : null;
  const votos = ley ? votosEsperados(game, ley, draft.concesiones) : null;
  const costoPunto = CFG.congreso.costoConcesion * game.perfil.costoConcesion;

  const setConcesion = (id: string, v: number) => {
    const c = { ...draft.concesiones };
    if (v <= 0) delete c[id];
    else c[id] = Math.min(CFG.congreso.concesionMax, v);
    setDraft({ concesiones: c });
  };

  return (
    <main className="stack">
      <section className="card stack">
        <h2>Bloques ({total} bancas)</h2>
        <p className="small muted">
          Afinidad de -100 (te odian) a 100 (te aman). La disciplina indica si votan en bloque. Cada punto de concesión cuesta{' '}
          {fmt(costoPunto, 2)}% PBI este trimestre y enoja un poco a la oposición.
        </p>
        {game.congreso.map((b) => (
          <div key={b.id} className="stack" style={{ gap: 4, paddingBottom: 8, borderBottom: '1px solid var(--color-border)' }}>
            <div className="row spread">
              <strong>{b.nombre}</strong>
              <span className="small muted">
                {TIPO[b.tipo]} · {b.bancas} bancas · disciplina {fmt(b.disciplina * 100, 0)}%
              </span>
            </div>
            <div className="row spread small">
              <span>Afinidad</span>
              <span className={b.afinidad >= 0 ? 'good' : 'bad'}>{fmt(b.afinidad, 0)}</span>
            </div>
            <Bar value={b.afinidad + 100} max={200} label={`Afinidad de ${b.nombre}`} color={b.afinidad >= 0 ? 'var(--color-good)' : 'var(--color-bad)'} />
            <div className="row small">
              <span>Concesiones:</span>
              <button type="button" aria-label={`Quitar concesión a ${b.nombre}`} onClick={() => setConcesion(b.id, (draft.concesiones[b.id] ?? 0) - 1)} disabled={!draft.concesiones[b.id]}>
                −
              </button>
              <span aria-live="polite">{draft.concesiones[b.id] ?? 0}</span>
              <button
                type="button"
                aria-label={`Sumar concesión a ${b.nombre}`}
                onClick={() => setConcesion(b.id, (draft.concesiones[b.id] ?? 0) + 1)}
                disabled={(draft.concesiones[b.id] ?? 0) >= CFG.congreso.concesionMax}
              >
                +
              </button>
            </div>
          </div>
        ))}
      </section>

      <fieldset className="stack">
        <legend>Ley a impulsar este trimestre</legend>
        {draft.guerra.declarar && (
          <p className="bad small">Este trimestre el Congreso vota la autorización para usar la fuerza. Si elegís una ley, se retira la declaración.</p>
        )}
        {draft.tratado && (
          <p className="warn small">
            Este trimestre el Congreso vota un tratado ({draft.tratado.tipo}). Si elegís una ley, se retira el tratado.
          </p>
        )}
        {votos && (
          <p aria-live="polite">
            Votos esperados: <strong className={votos.si / votos.total > 0.5 ? 'good' : 'bad'}>{fmt(votos.si, 0)}</strong> de {votos.total} (se necesita más de la mitad). El
            resultado real tiene azar.
          </p>
        )}
        <label className="option">
          <input type="radio" name="ley" checked={!draft.ley} onChange={() => setDraft({ ley: null })} />
          <span>Ninguna (el Congreso descansa, el país también)</span>
        </label>
        {LEYES.map((l) => {
          const aprobada = game.leyesAprobadas.includes(l.id);
          return (
            <label key={l.id} className="option" style={aprobada ? { opacity: 0.6 } : undefined}>
              <input type="radio" name="ley" disabled={aprobada} checked={draft.ley === l.id} onChange={() => setDraft({ ley: l.id, tratado: null, guerra: { ...draft.guerra, declarar: null } })} />
              <span>
                <strong>{l.nombre}</strong> {aprobada && <span className="chip">APROBADA</span>}
                <br />
                <span className="small muted">{l.descripcion}</span>
              </span>
            </label>
          );
        })}
      </fieldset>
    </main>
  );
}
