// En iOS Safari no existe beforeinstallprompt: mostramos un cartel discreto y descartable.
import { useState } from 'react';
import { escribirPref, leerPref } from '../save';

function esIosSafariNoInstalado(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const esIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const esSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  const standalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia?.('(display-mode: standalone)').matches;
  return esIos && esSafari && !standalone;
}

export function IosInstallHint() {
  const [visible, setVisible] = useState(() => esIosSafariNoInstalado() && leerPref('iosHintCerrado') !== '1');
  if (!visible) return null;
  return (
    <div className="card hint row spread" role="note">
      <span className="small">
        Para instalar la app: tocá <strong>Compartir</strong> y después <strong>Agregar a pantalla de inicio</strong>.
      </span>
      <button
        type="button"
        className="ghost"
        aria-label="Cerrar aviso de instalación"
        onClick={() => {
          escribirPref('iosHintCerrado', '1');
          setVisible(false);
        }}
      >
        ✕
      </button>
    </div>
  );
}
