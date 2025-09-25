import React from 'react';
import { motion } from 'motion/react';
import { Button } from './ui/button';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'default' | 'outline' | 'eco';
  };
  variant?: 'default' | 'documents' | 'reports' | 'analytics' | 'eco';
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  variant = 'default',
  className = ''
}: EmptyStateProps) {
  const prefersReducedMotion = typeof window !== 'undefined' && 
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const variantStyles = {
    default: {
      iconBg: 'bg-muted',
      iconColor: 'text-muted-foreground',
      illustration: null
    },
    documents: {
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-500',
      illustration: (
        <svg className="w-24 h-24 text-blue-200" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
        </svg>
      )
    },
    reports: {
      iconBg: 'bg-green-50',
      iconColor: 'text-green-500',
      illustration: (
        <svg className="w-24 h-24 text-green-200" fill="currentColor" viewBox="0 0 24 24">
          <path d="M19,3H5C3.9,3 3,3.9 3,5V19C3,20.1 3.9,21 5,21H19C20.1,21 21,20.1 21,19V5C21,3.9 20.1,3 19,3M19,19H5V5H19V19M17,15V7H15V15H17M13,15V9H11V15H13M9,15V11H7V15H9Z" />
        </svg>
      )
    },
    analytics: {
      iconBg: 'bg-purple-50',
      iconColor: 'text-purple-500',
      illustration: (
        <svg className="w-24 h-24 text-purple-200" fill="currentColor" viewBox="0 0 24 24">
          <path d="M22,21H2V3H4V19H6V10H10V19H12V6H16V19H18V14H22V21Z" />
        </svg>
      )
    },
    eco: {
      iconBg: 'bg-green-50',
      iconColor: 'text-green-600',
      illustration: (
        <motion.svg 
          className="w-24 h-24 text-green-200" 
          fill="currentColor" 
          viewBox="0 0 24 24"
          animate={!prefersReducedMotion ? { 
            rotate: [0, 5, -5, 0] 
          } : undefined}
          transition={{ 
            duration: 4, 
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        >
          <path d="M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L6.66,19.7C7.14,19.87 7.64,20 8,20C19,20 22,3 22,3C21,5 14,5.25 9,6.25C4,7.25 2,11.5 2,13.5C2,15.5 3.75,17.25 3.75,17.25C7,8 17,8 17,8Z" />
        </motion.svg>
      )
    }
  };

  const style = variantStyles[variant];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: prefersReducedMotion ? 0 : 0.5,
        ease: 'easeOut'
      }}
      className={`flex flex-col items-center justify-center py-12 px-6 text-center ${className}`}
    >
      {/* Иллюстрация или иконка */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ 
          duration: prefersReducedMotion ? 0 : 0.6,
          delay: 0.2,
          type: 'spring',
          stiffness: 200
        }}
        className="mb-6"
      >
        {style.illustration || (
          <div className={`
            w-16 h-16 rounded-full ${style.iconBg} 
            flex items-center justify-center mb-4
          `}>
            <div className={`w-8 h-8 ${style.iconColor}`}>
              {icon}
            </div>
          </div>
        )}
      </motion.div>

      {/* Заголовок */}
      <motion.h3
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ 
          duration: prefersReducedMotion ? 0 : 0.5,
          delay: 0.3
        }}
        className="text-xl font-semibold text-foreground mb-2"
      >
        {title}
      </motion.h3>

      {/* Описание */}
      {description && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ 
            duration: prefersReducedMotion ? 0 : 0.5,
            delay: 0.4
          }}
          className="text-muted-foreground max-w-md mb-6"
        >
          {description}
        </motion.p>
      )}

      {/* Действие */}
      {action && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ 
            duration: prefersReducedMotion ? 0 : 0.5,
            delay: 0.5
          }}
        >
          <Button
            onClick={action.onClick}
            variant={action.variant || 'default'}
            className={action.variant === 'eco' ? 
              'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700' : 
              ''
            }
          >
            {action.label}
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
}

// Специализированные компоненты для разных разделов
export function DocumentsEmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <EmptyState
      variant="documents"
      title="Документы не загружены"
      description="Загрузите документы для автоматического создания отчетов по выбросам парниковых газов"
      action={{
        label: 'Загрузить документы',
        onClick: onUpload,
        variant: 'eco'
      }}
    />
  );
}

export function ReportsEmptyState({ onGenerate }: { onGenerate: () => void }) {
  return (
    <EmptyState
      variant="reports"
      title="Отчеты еще не созданы"
      description="Создайте первый отчет на основе загруженных документов"
      action={{
        label: 'Создать отчет',
        onClick: onGenerate,
        variant: 'eco'
      }}
    />
  );
}

export function AnalyticsEmptyState() {
  return (
    <EmptyState
      variant="analytics"
      title="Недостаточно данных"
      description="Загрузите документы и создайте отчеты для просмотра аналитики"
    />
  );
}