import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Initialize Firestore with long polling enabled for better reliability in restricted environments
// and offline persistence for PWA support.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);

export const auth = getAuth(app);

// Test connection strictly as per guidelines
async function testConnection() {
  try {
    if (!navigator.onLine) {
      return;
    }
    
    // Attempt to reach the backend to verify configuration
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('Firestore connection verified');
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('the client is offline') || error.message.includes('unavailable')) {
        console.error("Firestore Error: Cloud Firestore backend is unreachable. This usually indicates network restrictions or incorrect Firebase project provisioning. Long polling is enabled to mitigate common proxy issues.");
      } else {
        console.warn("Firestore connection check status:", error.message);
      }
    }
  }
}

// Handle initial connection check with a small delay to allow service workers to settle
if (typeof window !== 'undefined') {
  setTimeout(testConnection, 2000);
}
