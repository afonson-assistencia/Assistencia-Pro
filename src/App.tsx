/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useState, useEffect, createContext, useContext, Component, ErrorInfo, ReactNode } from 'react';

// Error Boundary Component
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Ocorreu um erro</h2>
            <p className="text-gray-600 mb-6">
              {this.state.error?.message || 'Algo deu errado na aplicação.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
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
import { auth, db } from './firebase';
import { UserProfile } from './types';
import { getDocFromServer } from 'firebase/firestore';

// Test connection to Firestore
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. The client is offline.");
    }
    // Skip logging for other errors, as this is simply a connection test.
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
import Layout from './components/Layout';

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
      <AuthContext.Provider value={{ user, profile, loading }}>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
            <Route
              path="/"
              element={user ? <Layout /> : <Navigate to="/login" />}
            >
              <Route index element={<Dashboard />} />
              <Route path="customers" element={<Customers />} />
              <Route path="service-orders" element={<ServiceOrders />} />
              <Route path="inventory" element={<Inventory />} />
              <Route path="sales" element={<Sales />} />
              <Route path="expenses" element={<Expenses />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthContext.Provider>
    </ErrorBoundary>
  );
}
