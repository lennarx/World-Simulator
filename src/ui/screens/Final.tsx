import { CFG } from '../../data/config';
import { getPais } from '../../data/countries';
import { TITULOS_FINAL } from '../../data/texts';
import { Bar } from '../components/Bar';
import { IllustrativeBadge } from '../components/IllustrativeBadge';
import { nombrePais, relacionPromedio, type TipoResultadoGuerra } from '../../engine';
import { fmt, INDICADORES } from '../format';
import { borrarLocal, exportarArchivo } from '../save';
import { useGame } from '../store';

const RESULTADO_GUERRA: Record<TipoResultadoGuerra, string> = {
  victoria: 'Victoria',
  armisticio: 'Armisticio',
  cese_impuesto: 'Cese del fuego impuesto',
  derrota: 'Derrota',
};

const COMPONENTES = [
  ['crecimiento', 'Crecimiento'],
  ['estabilidad', 'Estabilidad de precios'],
  ['bienestar', 'Bienestar'],
  ['soberania', 'Soberanía (deuda, reservas, defensa)'],
  ['aprobacion', 'Aprobación final'],
] as const;

/** Mini gráfico de líneas accesible (con resumen textual). */
function Spark({ valores, label }: { valores: number[]; label: string }) {
  const w = 240;
  const h = 48;
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const rango = max - min || 1;
  const pts = valores.map((v, i) => `${(i / Math.max(1, valores.length - 1)) * w},${h - ((v - min) / rango) * h}`).join(' ');
  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img" aria-label={`${label}: de ${fmt(valores[0] ?? 0)} a ${fmt(valores.at(-1) ?? 0)}`}>
        <polyline points={pts} fill="none" stroke="var(--color-brand)" strokeWidth="2" />
      </svg>
      <figcaption className="small muted">
        {label}: {fmt(valores[0] ?? 0)} → {fmt(valores.at(-1) ?? 0)}
      </figcaption>
    </figure>
  );
}

export function Final() {
  const game = useGame((s) => s.game)!;
  const snapshot = useGame((s) => s.snapshot);
  const salir = useGame((s) => s.salir);
  const f = game.final!;
  const pais = getPais(game.paisId);

  return (
    <main className="stack">
      <section className="card stack">
        <div className="row spread">
          <h1>{TITULOS_FINAL[f.tipo]}</h1>
          <IllustrativeBadge />
        </div>
        <p>
          {pais.nombre} · {f.turno} de {CFG.turnosMandato} trimestres
        </p>
        <p>
          <em>{f.mensaje}</em>
        </p>
        <p className={f.victoria ? 'good' : 'bad'}>
          <strong>{f.victoria ? 'Victoria: dejaste un legado digno.' : f.tipo === 'reelecto' || f.tipo === 'mandato_gris' ? 'Sin victoria: el legado no alcanzó para la historia grande.' : 'Derrota: la historia no será generosa.'}</strong>
        </p>
      </section>

      <section className="card stack" aria-labelledby="legado">
        <h2 id="legado">
          Legado: {f.legado.total}/100 <span className="small muted">(victoria desde {CFG.legado.umbralVictoria})</span>
        </h2>
        {COMPONENTES.map(([k, nombre]) => (
          <div key={k} className="stack" style={{ gap: 4 }}>
            <div className="row spread small">
              <span>{nombre}</span>
              <span>{f.legado[k]}</span>
            </div>
            <Bar value={f.legado[k]} label={nombre} />
          </div>
        ))}
        <div className="row spread small">
          <span>Relación promedio con la región</span>
          <span>
            {fmt(relacionPromedio(game.relacionesBase), 0)} → {fmt(relacionPromedio(game.relaciones), 0)} · {game.tratados.length} tratado/s
            {game.crisisMaxNivel > 0 ? ` · crisis hasta nivel ${game.crisisMaxNivel}` : ''}
          </span>
        </div>
        {(game.guerrasPasadas.length > 0 || game.guerra) && (
          <div className="stack" style={{ gap: 4 }}>
            <div className="row spread small">
              <span>Conflictos armados (incluido en soberanía y estabilidad)</span>
              <span>{f.legado.guerra}</span>
            </div>
            <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
              {game.guerrasPasadas.map((g, i) => (
                <li key={i}>
                  {nombrePais(g.contra)}: {RESULTADO_GUERRA[g.resultado]} ({g.hasta - g.desde} trimestres{g.defensiva ? ', defensiva' : ''}
                  {g.autorizada ? '' : ', sin autorización'}) · costo humano {g.costoHumano}/100
                </li>
              ))}
              {game.guerra && <li>{nombrePais(game.guerra.contra)}: conflicto sin resolver al final del mandato.</li>}
            </ul>
          </div>
        )}
        <div className="row spread small">
          <span>Bonus por reelección</span>
          <span>+{f.legado.bonusReeleccion}</span>
        </div>
      </section>

      <section className="card grid" aria-label="Evolución">
        {(['inflacion', 'crecimiento', 'aprobacion', 'deuda'] as const).map((id) => (
          <Spark key={id} label={INDICADORES[id].nombre} valores={game.historial.map((h) => h.ind[id])} />
        ))}
      </section>

      <div className="row">
        <button
          type="button"
          onClick={() => {
            const s = snapshot();
            if (s) exportarArchivo(s);
          }}
        >
          Exportar partida
        </button>
        <button
          type="button"
          className="primary"
          onClick={() => {
            borrarLocal();
            salir();
          }}
        >
          Nueva partida
        </button>
      </div>
    </main>
  );
}
