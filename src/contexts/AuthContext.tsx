import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, User, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { UserProfile } from '../types';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  profile: null, 
  loading: true,
  signOut: async () => {} 
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const logAccess = async (firebaseUser: User) => {
    try {
      // Get IP and Location
      let ip = 'Unknown';
      let location = 'Unknown';
      try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        ip = data.ip || 'Unknown';
        location = `${data.city || ''}, ${data.region || ''}, ${data.country_name || ''}`.trim().replace(/^, |, $/g, '') || 'Unknown';
      } catch (e) {
        console.warn('Could not fetch IP/Location info', e);
      }

      await addDoc(collection(db, 'access_logs'), {
        userId: firebaseUser.uid,
        userEmail: firebaseUser.email,
        device: navigator.userAgent,
        ip,
        location,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error('Error logging access:', error);
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setProfile(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Log access on login
        logAccess(firebaseUser);

        const path = `users/${firebaseUser.uid}`;
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            const isAdminEmail = (email: string | null) => {
              return email?.toLowerCase() === 'admintec@gmail.com';
            };

            if (isAdminEmail(firebaseUser.email)) {
              if (data.role !== 'admin') {
                await setDoc(doc(db, 'users', firebaseUser.uid), { ...data, role: 'admin' }, { merge: true });
                setProfile({ id: userDoc.id, ...data, role: 'admin' } as UserProfile);
              } else {
                setProfile({ id: userDoc.id, ...data } as UserProfile);
              }
            } else {
              // If user is not admintec but has admin role, demote them to motoboy
              if (data.role === 'admin') {
                await setDoc(doc(db, 'users', firebaseUser.uid), { ...data, role: 'motoboy' }, { merge: true });
                setProfile({ id: userDoc.id, ...data, role: 'motoboy' } as UserProfile);
              } else {
                setProfile({ id: userDoc.id, ...data } as UserProfile);
              }
            }
          } else {
            const isAdminEmail = (email: string | null) => {
              return email?.toLowerCase() === 'admintec@gmail.com';
            };

            const newProfile = {
              email: firebaseUser.email || '',
              role: isAdminEmail(firebaseUser.email) ? 'admin' : 'motoboy',
              createdAt: serverTimestamp(),
            };
            await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
            setProfile({ id: firebaseUser.uid, ...newProfile } as any);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, path);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
