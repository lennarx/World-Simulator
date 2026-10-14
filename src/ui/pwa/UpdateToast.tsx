// Aviso de versión nueva. Con registerType 'autoUpdate' el SW nuevo se activa solo;
// interceptamos onNeedReload para no recargar de prepo y dejar que el jugador elija cuándo.
import { useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export function UpdateToast() {
  const [hayNueva, setHayNueva] = useState(false);
  const {
    offlineReady: [offlineReady, setOfflineReady],
  } = useRegisterSW({
    onNeedReload: () => setHayNueva(true),
    onRegisterError: () => {
      /* sin SW (ej. http sin TLS): la app igual funciona online */
    },
  });

  if (hayNueva) {
    return (
      <div className="toast" role="status" aria-live="polite">
        <span>Hay una versión nueva del simulador.</span>
        <button type="button" onClick={() => window.location.reload()}>
          Recargar
        </button>
      </div>
    );
  }
  if (offlineReady) {
    return (
      <div className="toast" role="status" aria-live="polite">
        <span>Listo: ya podés jugar sin conexión.</span>
        <button type="button" onClick={() => setOfflineReady(false)} aria-label="Cerrar aviso">
          OK
        </button>
      </div>
    );
  }
  return null;
}
