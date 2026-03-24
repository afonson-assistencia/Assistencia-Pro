/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import React, { useState, useEffect, createContext, useContext } from 'react';

import { auth, db } from './firebase';
import { UserProfile } from './types';
import { getDocFromServer } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './utils/firestoreErrorHandler';

import { ErrorBoundary } from './components/ErrorBoundary';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import ServiceOrders from './pages/ServiceOrders';
import Inventory from './pages/Inventory';
import Sales from './pages/Sales';
import Expenses from './pages/Expenses';
import CashClosure from './pages/CashClosure';
import Settings from './pages/Settings';
import ShoppingList from './pages/ShoppingList';
import DeliveryManagement from './pages/DeliveryManagement';
import MotoboyDashboard from './pages/MotoboyDashboard';
import MotoboyLogin from './pages/MotoboyLogin';
import Layout from './components/Layout';
import { SettingsProvider } from './contexts/SettingsContext';
import PWAUpdateNotification from './components/PWAUpdateNotification';

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

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const handleSignOut = async () => {
    try {
      await auth.signOut();
      setUser(null);
      setProfile(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  useEffect(() => {
    // Test connection to Firestore
    async function testConnection() {
      const path = 'test/connection';
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. The client is offline.");
        } else {
          // Log but don't throw to prevent app crash
          console.error("Firestore connection test failed:", error);
        }
      }
    }

    testConnection();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const path = `users/${firebaseUser.uid}`;
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            const isAdminEmail = (email: string | null) => {
              const adminEmails = ['afonsocnj@gmail.com', 'admintec@gmail.com'];
              return adminEmails.includes(email?.toLowerCase() || '');
            };

            // Ensure admin role if email matches, even if already exists
            if (isAdminEmail(firebaseUser.email) && data.role !== 'admin') {
              await setDoc(doc(db, 'users', firebaseUser.uid), { ...data, role: 'admin' }, { merge: true });
              setProfile({ id: userDoc.id, ...data, role: 'admin' } as UserProfile);
            } else {
              setProfile({ id: userDoc.id, ...data } as UserProfile);
            }
          } else {
            // Create default profile for new user
            const isAdminEmail = (email: string | null) => {
              const adminEmails = ['afonsocnj@gmail.com', 'admintec@gmail.com'];
              return adminEmails.includes(email?.toLowerCase() || '');
            };

            const newProfile = {
              email: firebaseUser.email || '',
              role: isAdminEmail(firebaseUser.email) ? 'admin' : 'staff',
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

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-900 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <SettingsProvider>
        <PWAUpdateNotification />
        <AuthContext.Provider value={{ user, profile, loading, signOut: handleSignOut }}>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
              <Route path="/motoboy-login" element={!user ? <MotoboyLogin /> : <Navigate to="/" />} />
              <Route
                path="/"
                element={user ? <Layout /> : <Landing />}
              >
                <Route index element={profile?.role === 'motoboy' ? <Navigate to="/motoboy-dashboard" /> : <Dashboard />} />
                <Route path="customers" element={user ? <Customers /> : <Navigate to="/login" />} />
                <Route path="service-orders" element={user ? <ServiceOrders /> : <Navigate to="/login" />} />
                <Route path="inventory" element={user ? <Inventory /> : <Navigate to="/login" />} />
                <Route path="shopping-list" element={user ? <ShoppingList /> : <Navigate to="/login" />} />
                <Route path="sales" element={user ? <Sales /> : <Navigate to="/login" />} />
                <Route path="expenses" element={user ? <Expenses /> : <Navigate to="/login" />} />
                <Route path="cash-closure" element={user ? <CashClosure /> : <Navigate to="/login" />} />
                <Route path="settings" element={user ? <Settings /> : <Navigate to="/login" />} />
                <Route path="delivery-management" element={user ? <DeliveryManagement /> : <Navigate to="/login" />} />
                <Route path="motoboy-dashboard" element={user ? <MotoboyDashboard /> : <Navigate to="/login" />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthContext.Provider>
      </SettingsProvider>
    </ErrorBoundary>
  );
}
