/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import React, { Component, ErrorInfo, ReactNode, useState, useEffect, createContext, useContext } from 'react';

import { auth, db } from './firebase';
import { UserProfile } from './types';
import { getDocFromServer } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './utils/firestoreErrorHandler';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import ServiceOrders from './pages/ServiceOrders';
import Inventory from './pages/Inventory';
import Sales from './pages/Sales';
import Expenses from './pages/Expenses';
import CashClosure from './pages/CashClosure';
import Settings from './pages/Settings';
import DeliveryManagement from './pages/DeliveryManagement';
import MotoboyDashboard from './pages/MotoboyDashboard';
import MotoboyLogin from './pages/MotoboyLogin';
import Layout from './components/Layout';
import { SettingsProvider } from './contexts/SettingsContext';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, profile: null, loading: true });

export const useAuth = () => useContext(AuthContext);

// Error Boundary Component
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 text-center">
          <div className="max-w-md rounded-2xl bg-white p-8 shadow-xl">
            <div className="mb-4 flex justify-center">
              <div className="rounded-full bg-red-100 p-3 text-red-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
            </div>
            <h1 className="mb-2 text-2xl font-bold text-slate-900">Ops! Algo deu errado</h1>
            <p className="mb-6 text-slate-600">
              Ocorreu um erro inesperado. Por favor, tente recarregar a página.
            </p>
            <div className="mb-6 overflow-hidden rounded-lg bg-slate-100 p-4 text-left text-xs font-mono text-slate-700">
              {this.state.error?.message}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white transition-all hover:bg-slate-800 active:scale-95"
            >
              Recarregar Página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

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
        <AuthContext.Provider value={{ user, profile, loading }}>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
              <Route path="/motoboy-login" element={!user ? <MotoboyLogin /> : <Navigate to="/" />} />
              <Route
                path="/"
                element={user ? <Layout /> : <Navigate to="/login" />}
              >
                <Route index element={profile?.role === 'motoboy' ? <Navigate to="/motoboy-dashboard" /> : <Dashboard />} />
                <Route path="customers" element={<Customers />} />
                <Route path="service-orders" element={<ServiceOrders />} />
                <Route path="inventory" element={<Inventory />} />
                <Route path="sales" element={<Sales />} />
                <Route path="expenses" element={<Expenses />} />
                <Route path="cash-closure" element={<CashClosure />} />
                <Route path="settings" element={<Settings />} />
                <Route path="delivery-management" element={<DeliveryManagement />} />
                <Route path="motoboy-dashboard" element={<MotoboyDashboard />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthContext.Provider>
      </SettingsProvider>
    </ErrorBoundary>
  );
}
