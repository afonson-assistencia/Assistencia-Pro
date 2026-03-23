import React, { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';

export default function PWAUpdateNotification() {
  const [show, setShow] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((registration) => {
        if (registration) {
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  setWaitingWorker(newWorker);
                  setShow(true);
                }
              });
            }
          });

          // Check if there's already a waiting worker
          if (registration.waiting) {
            setWaitingWorker(registration.waiting);
            setShow(true);
          }
        }
      });
    }
  }, []);

  const reloadPage = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }
    setShow(false);
    window.location.reload();
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-[9999] sm:left-auto sm:right-6 sm:bottom-6 sm:w-80 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-blue-600 text-white p-4 rounded-xl shadow-2xl border border-blue-500 flex items-center gap-4">
        <div className="p-2 bg-blue-500 rounded-lg">
          <RefreshCw className="h-5 w-5 animate-spin-slow" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold">Nova versão disponível!</p>
          <p className="text-xs text-blue-100">Atualize para as melhorias mais recentes.</p>
        </div>
        <div className="flex flex-col gap-2">
          <button 
            onClick={reloadPage}
            className="px-3 py-1.5 bg-white text-blue-600 text-xs font-bold rounded-lg hover:bg-blue-50 transition-colors"
          >
            Atualizar
          </button>
          <button 
            onClick={() => setShow(false)}
            className="p-1 text-blue-200 hover:text-white transition-colors self-end"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
