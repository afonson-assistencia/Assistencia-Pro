import { useEffect } from 'react';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';
import React from 'react';

export default function PWAUpdateNotification() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((registration) => {
        if (registration) {
          const onUpdateFound = () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  showUpdateToast(newWorker);
                }
              });
            }
          };

          registration.addEventListener('updatefound', onUpdateFound);

          // Check if there's already a waiting worker
          if (registration.waiting) {
            showUpdateToast(registration.waiting);
          }
        }
      });
    }
  }, []);

  const showUpdateToast = (worker: ServiceWorker) => {
    toast.info('Nova versão disponível!', {
      description: 'Atualize para as melhorias mais recentes.',
      duration: Infinity,
      action: {
        label: 'Atualizar',
        onClick: () => {
          worker.postMessage({ type: 'SKIP_WAITING' });
          window.location.reload();
        },
      },
      icon: <RefreshCw className="h-4 w-4 animate-spin-slow" />,
    });
  };

  return null;
}
