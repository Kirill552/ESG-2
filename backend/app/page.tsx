'use client'

import React, { useCallback, useEffect, useState } from 'react';
import { Landing } from './components/Landing';
import { AuthForm } from './components/AuthForm';
import { Dashboard } from './components/Dashboard';
import { Analytics } from './components/Analytics';
import { Documents } from './components/Documents';
import { Reports } from './components/Reports';
import { Settings } from './components/Settings';
import { Pricing } from './components/Pricing';

type Page = 'landing' | 'auth' | 'dashboard' | 'analytics' | 'documents' | 'reports' | 'settings' | 'pricing';

const secureViews: ReadonlyArray<Page> = ['dashboard', 'analytics', 'documents', 'reports', 'settings', 'pricing'];

const allowedViews = new Set<Page>([
  'landing',
  'auth',
  'dashboard',
  'analytics',
  'documents',
  'reports',
  'settings',
  'pricing',
]);

const getViewFromSearch = (search: string): Page | null => {
  const params = new URLSearchParams(search);
  const viewParam = params.get('view');
  if (!viewParam) {
    return null;
  }

  if (allowedViews.has(viewParam as Page)) {
    return viewParam as Page;
  }

  return null;
};

const updateViewInUrl = (view: Page) => {
  if (typeof window === 'undefined') {
    return;
  }

  const params = new URLSearchParams(window.location.search);

  if (view === 'landing') {
    params.delete('view');
  } else {
    params.set('view', view);
  }

  const query = params.toString();
  const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
  window.history.replaceState(null, '', nextUrl);
};

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('landing');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const navigateTo = useCallback((page: Page) => {
    setCurrentPage(page);
    updateViewInUrl(page);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const viewFromUrl = getViewFromSearch(window.location.search);

    const detectSession = async () => {
      try {
        const response = await fetch('/api/auth/session', {
          credentials: 'include',
        });

        if (response.ok) {
          const session = await response.json().catch(() => null);

          if (session?.user) {
            setIsAuthenticated(true);
            const targetView = viewFromUrl && viewFromUrl !== 'landing' && viewFromUrl !== 'auth'
              ? viewFromUrl
              : 'dashboard';
            navigateTo(targetView);
            return;
          }
        }
      } catch (error) {
        console.warn('Session detection failed', error);
      }

      if (viewFromUrl) {
        if (secureViews.includes(viewFromUrl) || viewFromUrl === 'dashboard') {
          navigateTo('auth');
        } else {
          navigateTo(viewFromUrl);
        }
      } else {
        navigateTo('landing');
      }
    };

    detectSession();
  }, [navigateTo]);

  const handleLogin = () => {
    setIsAuthenticated(true);
    navigateTo('dashboard');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    navigateTo('landing');
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'landing':
        return <Landing onLoginClick={() => navigateTo('auth')} />;
      case 'auth':
        return <AuthForm onSuccess={handleLogin} onBack={() => navigateTo('landing')} />;
      case 'dashboard':
        return <Dashboard onNavigate={(page) => navigateTo(page)} onLogout={handleLogout} />;
      case 'analytics':
        return <Analytics onNavigate={(page) => navigateTo(page)} onLogout={handleLogout} />;
      case 'documents':
        return <Documents onNavigate={(page) => navigateTo(page)} onLogout={handleLogout} />;
      case 'reports':
        return <Reports onNavigate={(page) => navigateTo(page)} onLogout={handleLogout} />;
      case 'settings':
        return <Settings onNavigate={(page) => navigateTo(page)} onLogout={handleLogout} />;
      case 'pricing':
        return <Pricing onNavigate={(page) => navigateTo(page)} onLogout={handleLogout} />;
      default:
        return <Landing onLoginClick={() => navigateTo('auth')} />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {renderPage()}
    </div>
  );
}