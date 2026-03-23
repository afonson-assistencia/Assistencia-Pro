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

// Test connection to Firestore
async function testConnection() {
  const path = 'test/connection';
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. The client is offline.");
    } else {
      handleFirestoreError(error, OperationType.GET, path);
    }
  }
}

testConnection();

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

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  );
}
