'use client'

import React, { useState } from 'react';
import { Landing } from './components/Landing';
import { AuthForm } from './components/AuthForm';
import { Dashboard } from './components/Dashboard';
import { Analytics } from './components/Analytics';
import { Documents } from './components/Documents';
import { Reports } from './components/Reports';
import { Settings } from './components/Settings';
import { Pricing } from './components/Pricing';
import { Toaster } from './components/Toaster';

type Page = 'landing' | 'auth' | 'dashboard' | 'analytics' | 'documents' | 'reports' | 'settings' | 'pricing';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('landing');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handleLogin = () => {
    setIsAuthenticated(true);
    setCurrentPage('dashboard');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentPage('landing');
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'landing':
        return <Landing onLoginClick={() => setCurrentPage('auth')} />;
      case 'auth':
        return <AuthForm onSuccess={handleLogin} onBack={() => setCurrentPage('landing')} />;
      case 'dashboard':
        return <Dashboard onNavigate={setCurrentPage} onLogout={handleLogout} />;
      case 'analytics':
        return <Analytics onNavigate={setCurrentPage} onLogout={handleLogout} />;
      case 'documents':
        return <Documents onNavigate={setCurrentPage} onLogout={handleLogout} />;
      case 'reports':
        return <Reports onNavigate={setCurrentPage} onLogout={handleLogout} />;
      case 'settings':
        return <Settings onNavigate={setCurrentPage} onLogout={handleLogout} />;
      case 'pricing':
        return <Pricing onNavigate={setCurrentPage} onLogout={handleLogout} />;
      default:
        return <Landing onLoginClick={() => setCurrentPage('auth')} />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {renderPage()}
      <Toaster />
    </div>
  );
}