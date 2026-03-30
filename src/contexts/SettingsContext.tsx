import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

interface BusinessSettings {
  name: string;
  logoUrl: string;
}

interface SettingsContextType {
  settings: BusinessSettings;
  updateSettings: (newSettings: BusinessSettings) => Promise<void>;
  loading: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<BusinessSettings>({
    name: 'Assistência Pro',
    logoUrl: '/logo.png',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const path = 'settings/business';
    const unsub = onSnapshot(doc(db, 'settings', 'business'), (docSnap) => {
      if (docSnap.exists()) {
        setSettings(docSnap.data() as BusinessSettings);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });

    return () => unsub();
  }, []);

  const updateSettings = async (newSettings: BusinessSettings) => {
    const path = 'settings/business';
    try {
      await setDoc(doc(db, 'settings', 'business'), newSettings);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, loading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
