import { CFG } from '../../data/config';
import { getPais } from '../../data/countries';
import { getLey, nombrePais, previewFiscal, probGolpe, probJuicio, type IndicadorId } from '../../engine';
import { Bar } from '../components/Bar';
import { GuerraCard } from '../components/GuerraCard';
import { Indicator } from '../components/Indicator';
import { MapaSudamerica } from '../components/MapaSudamerica';
import { fmt } from '../format';
import { useGame } from '../store';

const ORDEN: IndicadorId[] = ['crecimiento', 'inflacion', 'desempleo', 'deuda', 'reservas', 'aprobacion', 'gobernabilidad', 'estabilidad', 'capacidadMilitar'];

export function Panel() {
  const game = useGame((s) => s.game)!;
  const draft = useGame((s) => s.draft)!;
  const irA = useGame((s) => s.irA);
  const cerrar = useGame((s) => s.cerrarTrimestre);
  const pais = getPais(game.paisId);
  const anterior = game.historial.at(-2)?.ind;
  const f = previewFiscal(game, draft);
  const ley = draft.ley ? getLey(draft.ley) : null;
  const riesgoJuicio = probJuicio(game);
  const riesgoGolpe = probGolpe(game);

  return (
    <main className="stack">
      <GuerraCard compacta />
      <section className="card stack">
        <p className="small muted">{pais.problema}</p>
        <div className="row spread small">
          <span>Desgaste (presión)</span>
          <span>{fmt(game.presion, 0)}/100</span>
        </div>
        <Bar value={game.presion} label="Presión acumulada" color="var(--color-warn)" />
        {game.crisis && (
          <p className="bad small">
            Crisis de frontera con {nombrePais(game.crisis.con)} (nivel {game.crisis.nivel}/3).{' '}
            <button type="button" className="ghost" onClick={() => irA('diplomacia')}>
              Responder
            </button>
          </p>
        )}
        {game.escandaloActivo > 0 && <p className="bad small">Escándalo activo: la oposición está al acecho ({game.escandaloActivo} turno/s).</p>}
        {riesgoJuicio > 0 && <p className="bad small">Riesgo de juicio político este trimestre: {fmt(riesgoJuicio * 100, 0)}%.</p>}
        {riesgoGolpe > 0 && <p className="bad small">Riesgo de quiebre institucional: {fmt(riesgoGolpe * 100, 0)}%.</p>}
        {game.ind.gobernabilidad < CFG.finales.gobCritica && (
          <p className="bad small">
            Gobernabilidad crítica ({game.turnosGobBaja}/{CFG.finales.turnosGobCritica} turnos). Si sigue así, caés.
          </p>
        )}
      </section>

      <section aria-label="Indicadores" className="grid">
        {ORDEN.map((id) => (
          <Indicator key={id} id={id} valor={game.ind[id]} anterior={anterior?.[id]} />
        ))}
      </section>

      <section className="card stack" aria-label="Resumen de decisiones">
        <h2>Este trimestre</h2>
        <div className="row spread">
          <span>Déficit proyectado</span>
          <strong className={f.deficit > 3 ? 'bad' : f.deficit < 0 ? 'good' : ''}>{fmt(f.deficit)}% PBI</strong>
        </div>
        <div className="row spread small">
          <span>Financiamiento</span>
          <span>{draft.financiamiento === 'deuda' ? 'Deuda' : draft.financiamiento === 'emision' ? 'Emisión' : 'Mixto'}</span>
        </div>
        <div className="row spread small">
          <span>Prima de riesgo</span>
          <span>{fmt(game.primaRiesgo)} pp</span>
        </div>
        {f.enAtraso && <p className="bad small">Pagás menos que los intereses exigibles ({fmt(f.intereses)}% PBI): vas a entrar en atraso.</p>}
        <div className="row spread small">
          <span>En el Congreso</span>
          <span>
            {draft.guerra.declarar
              ? `Autorización de guerra contra ${nombrePais(draft.guerra.declarar)}`
              : draft.tratado
                ? `Tratado de ${draft.tratado.tipo} con ${nombrePais(draft.tratado.con)}`
                : ley
                  ? ley.nombre
                  : 'Nada'}
          </span>
        </div>
        <div className="row spread small">
          <span>Acciones diplomáticas</span>
          <span>{draft.diplomacia.length ? draft.diplomacia.map((a) => `${a.tipo} (${nombrePais(a.con)})`).join(', ') : 'Ninguna'}</span>
        </div>
        <div className="row">
          <button type="button" onClick={() => irA('presupuesto')}>
            Presupuesto
          </button>
          <button type="button" onClick={() => irA('congreso')}>
            Congreso
          </button>
          <button type="button" onClick={() => irA('diplomacia')}>
            Exterior
          </button>
          <button type="button" className="primary" onClick={cerrar}>
            Cerrar trimestre
          </button>
        </div>
      </section>
      <section className="card stack" aria-labelledby="region-titulo">
        <div className="row spread">
          <h2 id="region-titulo">La región</h2>
          <button type="button" onClick={() => irA('diplomacia')}>
            Ver en Exterior
          </button>
        </div>
        {/* Con mouse/tacto el mapa entero lleva a Exterior; con teclado, el botón de arriba. */}
        <div onClick={() => irA('diplomacia')} style={{ cursor: 'pointer' }}>
          <MapaSudamerica game={game} compacto />
        </div>
      </section>
    </main>
  );
}
