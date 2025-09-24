import React from 'react';
import { motion } from 'motion/react';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

interface FloatingActionButtonProps {
  icon: React.ReactNode;
  onClick: () => void;
  tooltip?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  variant?: 'default' | 'eco' | 'processing' | 'success';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function FloatingActionButton({
  icon,
  onClick,
  tooltip,
  position = 'bottom-right',
  variant = 'default',
  size = 'md',
  className = ''
}: FloatingActionButtonProps) {
  const prefersReducedMotion = typeof window !== 'undefined' && 
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const positionClasses = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'top-right': 'top-6 right-6',
    'top-left': 'top-6 left-6'
  };

  const variantClasses = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25',
    eco: 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 shadow-lg shadow-green-500/25',
    processing: 'bg-blue-500 text-white hover:bg-blue-600 shadow-lg shadow-blue-500/25',
    success: 'bg-green-500 text-white hover:bg-green-600 shadow-lg shadow-green-500/25'
  };

  const sizeClasses = {
    sm: 'h-12 w-12',
    md: 'h-14 w-14',
    lg: 'h-16 w-16'
  };

  const iconSizeClasses = {
    sm: 'h-5 w-5',
    md: 'h-6 w-6',
    lg: 'h-7 w-7'
  };

  const buttonContent = (
    <motion.div
      className={`fixed z-50 ${positionClasses[position]} ${className}`}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ 
        type: 'spring', 
        stiffness: 300, 
        damping: 25,
        duration: prefersReducedMotion ? 0 : undefined
      }}
      whileHover={!prefersReducedMotion ? { 
        scale: 1.1,
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      } : undefined}
      whileTap={!prefersReducedMotion ? { scale: 0.95 } : undefined}
    >
      <Button
        onClick={onClick}
        className={`
          ${sizeClasses[size]} 
          ${variantClasses[variant]}
          rounded-full
          border-0
          transition-all
          duration-300
          backdrop-blur-sm
          hover:shadow-xl
          active:scale-95
        `}
      >
        <motion.div
          className={iconSizeClasses[size]}
          animate={!prefersReducedMotion ? { 
            rotate: [0, 5, -5, 0] 
          } : undefined}
          transition={{ 
            duration: 2, 
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        >
          {icon}
        </motion.div>
      </Button>
    </motion.div>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {buttonContent}
          </TooltipTrigger>
          <TooltipContent side="left" className="font-medium">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return buttonContent;
}