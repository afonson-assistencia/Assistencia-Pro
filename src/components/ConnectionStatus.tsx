import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { WifiOff, Wifi, CloudLightning } from 'lucide-react';

export default function ConnectionStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(() => 
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  // Track if we have already shown an offline message, so we only show the "back online" flash when returning to online
  const [hasBeenOffline, setHasBeenOffline] = useState(false);
  const [showOnlineFlash, setShowOnlineFlash] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (hasBeenOffline) {
        setShowOnlineFlash(true);
        const timer = setTimeout(() => {
          setShowOnlineFlash(false);
          setHasBeenOffline(false);
        }, 4000);
        return () => clearTimeout(timer);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setHasBeenOffline(true);
      setShowOnlineFlash(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    if (!navigator.onLine) {
      setHasBeenOffline(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [hasBeenOffline]);

  return (
    <div id="connection-status-root" className="pointer-events-none fixed top-4 left-0 right-0 z-[10000] flex justify-center px-4">
      <AnimatePresence mode="wait">
        {/* Offline Warning Card */}
        {!isOnline && (
          <motion.div
            id="connection-status-offline"
            initial={{ opacity: 0, y: -50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="pointer-events-auto flex items-center gap-3 rounded-full border border-amber-200 bg-amber-50 px-5 py-2.5 shadow-lg dark:border-amber-900/30 dark:bg-amber-950/90 text-amber-900 dark:text-amber-200 max-w-md md:max-w-xl text-center"
          >
            <WifiOff className="h-5 w-5 shrink-0 animate-pulse text-amber-600 dark:text-amber-400" />
            <div className="flex flex-col items-start text-left text-xs md:text-sm">
              <span className="font-semibold">Modo Offline Ativo</span>
              <p className="text-[11px] opacity-90 leading-tight">
                Você perdeu a conexão Wi-Fi. O sistema continuará funcionando e salvará suas alterações localmente.
              </p>
            </div>
          </motion.div>
        )}

        {/* Back Online Flash Message */}
        {isOnline && showOnlineFlash && (
          <motion.div
            id="connection-status-online"
            initial={{ opacity: 0, y: -50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-emerald-200 bg-emerald-50 px-5 py-2.5 shadow-lg dark:border-emerald-900/40 dark:bg-emerald-950/90 text-emerald-900 dark:text-emerald-200"
          >
            <Wifi className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs md:text-sm font-semibold">Conexão Restabelecida! Seus dados foram sincronizados.</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
