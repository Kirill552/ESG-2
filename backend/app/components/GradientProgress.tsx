import React from 'react';
import { motion } from 'motion/react';
import { Progress } from './ui/progress';

interface GradientProgressProps {
  value: number;
  max?: number;
  variant?: 'default' | 'eco' | 'processing' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  label?: string;
  animated?: boolean;
  className?: string;
}

export function GradientProgress({
  value,
  max = 100,
  variant = 'default',
  size = 'md',
  showLabel = false,
  label,
  animated = true,
  className = ''
}: GradientProgressProps) {
  const percentage = Math.min((value / max) * 100, 100);
  
  const prefersReducedMotion = typeof window !== 'undefined' && 
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const variantStyles = {
    default: {
      gradient: 'from-primary/20 to-primary',
      bg: 'bg-primary/10',
      glow: 'shadow-primary/25'
    },
    eco: {
      gradient: 'from-green-400 to-emerald-600',
      bg: 'bg-green-100',
      glow: 'shadow-green-500/25'
    },
    processing: {
      gradient: 'from-blue-400 to-blue-600',
      bg: 'bg-blue-100',
      glow: 'shadow-blue-500/25'
    },
    success: {
      gradient: 'from-green-400 to-green-600',
      bg: 'bg-green-100',
      glow: 'shadow-green-500/25'
    },
    warning: {
      gradient: 'from-yellow-400 to-orange-500',
      bg: 'bg-yellow-100',
      glow: 'shadow-yellow-500/25'
    },
    error: {
      gradient: 'from-red-400 to-red-600',
      bg: 'bg-red-100',
      glow: 'shadow-red-500/25'
    }
  };

  const sizeStyles = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4'
  };

  const style = variantStyles[variant];

  return (
    <div className={`space-y-2 ${className}`}>
      {(showLabel || label) && (
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">
            {label || 'Прогресс'}
          </span>
          <span className="text-sm font-medium">
            {Math.round(percentage)}%
          </span>
        </div>
      )}
      
      <div className={`relative overflow-hidden rounded-full ${style.bg} ${sizeStyles[size]}`}>
        {/* Анимированный фон */}
        {animated && !prefersReducedMotion && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            animate={{ x: ['-100%', '100%'] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
          />
        )}
        
        {/* Основной прогресс бар */}
        <motion.div
          className={`h-full bg-gradient-to-r ${style.gradient} rounded-full shadow-sm ${style.glow}`}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ 
            duration: prefersReducedMotion ? 0 : 1.5,
            ease: 'easeOut'
          }}
        />
        
        {/* Эффект блеска */}
        {animated && !prefersReducedMotion && percentage > 0 && (
          <motion.div
            className="absolute inset-y-0 right-0 w-8 bg-gradient-to-r from-transparent to-white/30"
            animate={{ opacity: [0, 1, 0] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
          />
        )}
      </div>
    </div>
  );
}

// Специализированный компонент для отчетов
interface ReportProgressProps {
  completed: number;
  total: number;
  stage: string;
  className?: string;
}

export function ReportProgress({ completed, total, stage, className = '' }: ReportProgressProps) {
  const percentage = (completed / total) * 100;
  
  const getVariant = () => {
    if (percentage === 100) return 'success';
    if (percentage >= 75) return 'eco';
    if (percentage >= 25) return 'processing';
    return 'default';
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex justify-between items-center">
        <h4 className="font-medium text-foreground">{stage}</h4>
        <span className="text-sm text-muted-foreground">
          {completed} из {total}
        </span>
      </div>
      
      <GradientProgress
        value={percentage}
        variant={getVariant()}
        animated={true}
        size="md"
      />
      
      {percentage === 100 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-2 text-sm text-green-600"
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Этап завершен
        </motion.div>
      )}
    </div>
  );
}