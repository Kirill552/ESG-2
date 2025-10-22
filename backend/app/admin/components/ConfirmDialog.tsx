'use client';

/**
 * Модальное окно подтверждения опасных действий
 * Используется для: удаления, блокировки, отклонения и т.д.
 */

import { useEffect } from 'react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Подтвердить',
  cancelText = 'Отмена',
  variant = 'danger',
  loading = false,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (isOpen) {
      // Блокируем скролл при открытии
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    // Обработчик ESC
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !loading) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    await onConfirm();
  };

  const variantStyles = {
    danger: {
      icon: (
        <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      ),
      iconBg: 'bg-red-500/10',
      iconBorder: 'border-red-500/20',
      buttonClass: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
    },
    warning: {
      icon: (
        <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      ),
      iconBg: 'bg-yellow-500/10',
      iconBorder: 'border-yellow-500/20',
      buttonClass: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500',
    },
    info: {
      icon: (
        <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      iconBg: 'bg-blue-500/10',
      iconBorder: 'border-blue-500/20',
      buttonClass: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
    },
  };

  const styles = variantStyles[variant];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={loading ? undefined : onClose}
      />

      {/* Dialog */}
      <div className="relative bg-gray-900 border border-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4 animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-start gap-4 p-6 pb-4">
          <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center border ${styles.iconBg} ${styles.iconBorder}`}>
            {styles.icon}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
            <p className="text-sm text-gray-400 leading-relaxed">{message}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 px-6 pb-6">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className={`flex-1 px-4 py-2.5 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${styles.buttonClass}`}
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                <span>Выполняется...</span>
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
