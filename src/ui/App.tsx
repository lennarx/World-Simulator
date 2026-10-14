import { useEffect, useState } from 'react';
import { CFG } from '../data/config';
import { getPais } from '../data/countries';
import { IllustrativeBadge } from './components/IllustrativeBadge';
import { trimestre } from './format';
import { InstallButton } from './pwa/InstallButton';
import { IosInstallHint } from './pwa/IosInstallHint';
import { UpdateToast } from './pwa/UpdateToast';
import { exportarArchivo, escribirPref, leerPref } from './save';
import { Congreso } from './screens/Congreso';
import { Final } from './screens/Final';
import { Inicio } from './screens/Inicio';
import { Panel } from './screens/Panel';
import { Parte } from './screens/Parte';
import { Presupuesto } from './screens/Presupuesto';
import { useGame, type Pantalla } from './store';

type Tema = 'auto' | 'light' | 'dark';

function useTema(): [Tema, () => void] {
  const [tema, setTema] = useState<Tema>(() => (leerPref('tema') as Tema) ?? 'auto');
  useEffect(() => {
    const root = document.documentElement;
    if (tema === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', tema);
    escribirPref('tema', tema === 'auto' ? null : tema);
  }, [tema]);
  const ciclar = () => setTema((t) => (t === 'auto' ? 'dark' : t === 'dark' ? 'light' : 'auto'));
  return [tema, ciclar];
}

const TABS: [Pantalla, string][] = [
  ['panel', 'Panel'],
  ['presupuesto', 'Presupuesto'],
  ['congreso', 'Congreso'],
  ['parte', 'Partes'],
];

export function App() {
  const { game, pantalla, irA, salir, snapshot, guardadoOk } = useGame();
  const [tema, ciclarTema] = useTema();
  const enJuego = game && !game.final && pantalla !== 'inicio';

  const temaLabel = tema === 'auto' ? 'Tema: automático' : tema === 'dark' ? 'Tema: oscuro' : 'Tema: claro';

  return (
    <div className="app">
      <header className="header row spread">
        <div>
          {game ? (
            <>
              <strong>{getPais(game.paisId).nombre}</strong>{' '}
              <span className="small muted">
                {game.final ? 'Mandato terminado' : `${trimestre(game.turno + 1)} · turno ${game.turno + 1}/${CFG.turnosMandato}`}
              </span>
            </>
          ) : (
            <strong>Gobierno SA</strong>
          )}
        </div>
        <div className="row">
          <InstallButton />
          <button type="button" className="ghost" onClick={ciclarTema} aria-label={`${temaLabel}. Cambiar tema`} title={temaLabel}>
            {tema === 'dark' ? '🌙' : tema === 'light' ? '☀️' : '🌓'}
          </button>
          {game && (
            <details style={{ position: 'relative' }}>
              <summary className="btn" aria-label="Menú de partida">
                ⋯
              </summary>
              <div className="card stack" style={{ position: 'absolute', right: 0, zIndex: 20, minWidth: 200 }}>
                <button
                  type="button"
                  onClick={() => {
                    const s = snapshot();
                    if (s) exportarArchivo(s);
                  }}
                >
                  Exportar partida (JSON)
                </button>
                <button type="button" onClick={salir}>
                  Volver al inicio
                </button>
                <span className="small muted">{guardadoOk ? 'Guardado automático activo.' : 'No se pudo guardar en este navegador. Exportá la partida.'}</span>
              </div>
            </details>
          )}
        </div>
      </header>

      <div className="stack">
        <IosInstallHint />
        {game && pantalla !== 'inicio' && pantalla !== 'final' && (
          <div>
            <IllustrativeBadge />
          </div>
        )}
        {(!game || pantalla === 'inicio') && <Inicio />}
        {game && pantalla === 'panel' && <Panel />}
        {game && pantalla === 'presupuesto' && <Presupuesto />}
        {game && pantalla === 'congreso' && <Congreso />}
        {game && pantalla === 'parte' && <Parte />}
        {game && pantalla === 'final' && game.final && <Final />}
      </div>

      {enJuego && (
        <nav className="tabs" aria-label="Secciones">
          {TABS.map(([id, label]) => (
            <button key={id} type="button" aria-current={pantalla === id ? 'page' : undefined} onClick={() => irA(id)}>
              {label}
            </button>
          ))}
        </nav>
      )}
      <UpdateToast />
    </div>
  );
}
