import React from 'react';
import { Button } from './ui/button';
import { motion } from 'motion/react';
import {
  LayoutDashboard,
  BarChart3,
  FileText,
  ClipboardCheck,
  Settings,
  CreditCard,
  LogOut,
  User
} from 'lucide-react';
import { NotificationBell } from './NotificationBell';

type Page = 'dashboard' | 'analytics' | 'documents' | 'reports' | 'settings' | 'pricing';

interface LayoutProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

export function Layout({ currentPage, onNavigate, onLogout, children }: LayoutProps) {
  const navigation = [
    { key: 'dashboard' as Page, label: 'Главная', icon: LayoutDashboard },
    { key: 'analytics' as Page, label: 'Аналитика', icon: BarChart3 },
    { key: 'documents' as Page, label: 'Документы', icon: FileText },
    { key: 'reports' as Page, label: 'Отчеты', icon: ClipboardCheck },
    { key: 'settings' as Page, label: 'Настройки', icon: Settings },
    { key: 'pricing' as Page, label: 'Тарифы', icon: CreditCard },
  ];

  return (
    <div className="flex h-screen bg-[#fcfdfc]">
      {/* Sidebar */}
      <motion.div 
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="w-64 border-r border-gray-100 bg-white flex flex-col shadow-sm"
      >
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <svg className="h-8 w-8 text-[#1dc962]" fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <path clipRule="evenodd" d="M39.475 21.6262C40.358 21.4363 40.6863 21.5589 40.7581 21.5934C40.7876 21.655 40.8547 21.857 40.8082 22.3336C40.7408 23.0255 40.4502 24.0046 39.8572 25.2301C38.6799 27.6631 36.5085 30.6631 33.5858 33.5858C30.6631 36.5085 27.6632 38.6799 25.2301 39.8572C24.0046 40.4502 23.0255 40.7407 22.3336 40.8082C21.8571 40.8547 21.6551 40.7875 21.5934 40.7581C21.5589 40.6863 21.4363 40.358 21.6262 39.475C21.8562 38.4054 22.4689 36.9657 23.5038 35.2817C24.7575 33.2417 26.5497 30.9744 28.7621 28.762C30.9744 26.5497 33.2417 24.7574 35.2817 23.5037C36.9657 22.4689 38.4054 21.8562 39.475 21.6262ZM4.41189 29.2403L18.7597 43.5881C19.8813 44.7097 21.4027 44.9179 22.7217 44.7893C24.0585 44.659 25.5148 44.1631 26.9723 43.4579C29.9052 42.0387 33.2618 39.5667 36.4142 36.4142C39.5667 33.2618 42.0387 29.9052 43.4579 26.9723C44.1631 25.5148 44.659 24.0585 44.7893 22.7217C44.9179 21.4027 44.7097 19.8813 43.5881 18.7597L29.2403 4.41187C27.8527 3.02428 25.8765 3.02573 24.2861 3.36776C22.6081 3.72863 20.7334 4.58419 18.8396 5.74801C16.4978 7.18716 13.9881 9.18353 11.5858 11.5858C9.18354 13.988 7.18717 16.4978 5.74802 18.8396C4.58421 20.7334 3.72865 22.6081 3.36778 24.2861C3.02574 25.8765 3.02429 27.8527 4.41189 29.2403Z" fill="currentColor" fillRule="evenodd"></path>
            </svg>
            <span className="text-xl font-bold text-gray-900">ESG-Лайт</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navigation.map((item, index) => {
            const Icon = item.icon;
            const isActive = currentPage === item.key;

            return (
              <motion.div
                key={item.key}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  variant="ghost"
                  className={`w-full justify-start h-10 transition-all duration-200 ${
                    isActive
                      ? 'bg-[#1dc962] text-white hover:bg-[#1dc962]/90'
                      : 'text-[#58625d] hover:bg-gray-50 hover:text-gray-900'
                  }`}
                  onClick={() => onNavigate(item.key)}
                >
                  <Icon className="w-4 h-4 mr-3" />
                  <span className="font-medium">{item.label}</span>
                </Button>
              </motion.div>
            );
          })}
        </nav>
      </motion.div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header с уведомлениями */}
        <div className="h-16 border-b border-gray-100 bg-white flex items-center justify-end px-6 gap-3">
          <NotificationBell />
          <div className="w-px h-6 bg-gray-200"></div>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-3 py-2 text-[#58625d] hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-all duration-200"
          >
            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-[#58625d]" />
            </div>
            <span className="font-medium text-sm">Выйти</span>
          </button>
        </div>

        {/* Page Content */}
        {children}
      </div>
    </div>
  );
}