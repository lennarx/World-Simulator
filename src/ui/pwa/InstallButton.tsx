// Botón "Instalar" para Android/Chrome/Edge: captura beforeinstallprompt y lo dispara a pedido.
import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallButton() {
  const [evento, setEvento] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault(); // evitamos el mini-banner automático; mostramos nuestro botón
      setEvento(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setEvento(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!evento) return null;
  return (
    <button
      type="button"
      className="primary"
      onClick={async () => {
        try {
          await evento.prompt();
          await evento.userChoice;
        } finally {
          setEvento(null); // el evento solo se puede usar una vez
        }
      }}
    >
      Instalar
    </button>
  );
}
