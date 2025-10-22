'use client';

/**
 * Wrapper для всех админских страниц
 * Включает sidebar, breadcrumbs, и правильную структуру layout
 */

import { ReactNode } from 'react';
import AdminSidebar from './AdminSidebar';

interface AdminPageWrapperProps {
  children: ReactNode;
  title?: string;
  breadcrumbs?: { label: string; href?: string }[];
  actions?: ReactNode;
}

export default function AdminPageWrapper({
  children,
  title,
  breadcrumbs,
  actions,
}: AdminPageWrapperProps) {
  return (
    <div className="flex min-h-screen bg-gray-950">
      <AdminSidebar />

      <main className="flex-1 ml-64 transition-all duration-300">
        {/* Header с breadcrumbs и actions */}
        {(title || breadcrumbs || actions) && (
          <header className="sticky top-0 z-40 bg-gray-900/80 backdrop-blur-xl border-b border-gray-800">
            <div className="px-6 py-4">
              {breadcrumbs && breadcrumbs.length > 0 && (
                <nav className="flex items-center gap-2 text-sm mb-2">
                  {breadcrumbs.map((crumb, index) => (
                    <div key={index} className="flex items-center gap-2">
                      {index > 0 && (
                        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                      {crumb.href ? (
                        <a href={crumb.href} className="text-gray-400 hover:text-white transition-colors">
                          {crumb.label}
                        </a>
                      ) : (
                        <span className="text-white font-medium">{crumb.label}</span>
                      )}
                    </div>
                  ))}
                </nav>
              )}

              <div className="flex items-center justify-between">
                {title && <h1 className="text-2xl font-bold text-white">{title}</h1>}
                {actions && <div className="flex items-center gap-3">{actions}</div>}
              </div>
            </div>
          </header>
        )}

        {/* Основной контент */}
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
