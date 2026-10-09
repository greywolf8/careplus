/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { MobileAppShell } from './components/layout/MobileAppShell';
import { ToastContainer } from './components/common/ToastContainer';
import { LoginView } from './components/auth/LoginView';

import { PWAInstallFloatingBanner } from './components/pwa/PWAInstallFloatingBanner';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

const MainAppContent: React.FC = () => {
  const { isAuthenticated } = useAuth();

  return (
    <>
      {!isAuthenticated ? <LoginView /> : <MobileAppShell />}
      <PWAInstallFloatingBanner />
    </>
  );
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <NotificationProvider>
        <AuthProvider>
          <ToastContainer />
          <MainAppContent />
        </AuthProvider>
      </NotificationProvider>
    </QueryClientProvider>
  );
}
