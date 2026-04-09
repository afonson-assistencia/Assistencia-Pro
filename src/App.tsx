/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { doc } from 'firebase/firestore';
import React, { useEffect } from 'react';

import { db } from './firebase';
import { getDocFromServer } from 'firebase/firestore';

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
import StorefrontManager from './pages/StorefrontManager';
import PublicStorefront from './pages/PublicStorefront';
import DeliveryManagement from './pages/DeliveryManagement';
import DeliverySettings from './pages/DeliverySettings';
import StorefrontOrders from './pages/StorefrontOrders';
import MotoboyDashboard from './pages/MotoboyDashboard';
import MotoboyLogin from './pages/MotoboyLogin';
import AccessLogs from './pages/AccessLogs';
import Layout from './components/Layout';
import { SettingsProvider } from './contexts/SettingsContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import PWAUpdateNotification from './components/PWAUpdateNotification';
import { syncService } from './services/syncService';

function AppContent() {
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    // Initialize sync service
    syncService.init();

    // Test connection to Firestore
    async function testConnection() {
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
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-900 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
        <Route path="/motoboy-login" element={!user ? <MotoboyLogin /> : <Navigate to="/" />} />
        <Route path="/s/:slug" element={<PublicStorefront />} />
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
          <Route path="storefront" element={user ? <StorefrontManager /> : <Navigate to="/login" />} />
          <Route path="delivery-management" element={user ? <DeliveryManagement /> : <Navigate to="/login" />} />
          <Route path="delivery-settings" element={user ? <DeliverySettings /> : <Navigate to="/login" />} />
          <Route path="storefront-orders" element={user ? <StorefrontOrders /> : <Navigate to="/login" />} />
          <Route path="access-logs" element={user ? <AccessLogs /> : <Navigate to="/login" />} />
          <Route path="motoboy-dashboard" element={user ? <MotoboyDashboard /> : <Navigate to="/login" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SettingsProvider>
        <AuthProvider>
          <PWAUpdateNotification />
          <AppContent />
        </AuthProvider>
      </SettingsProvider>
    </ErrorBoundary>
  );
}
