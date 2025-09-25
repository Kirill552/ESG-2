import React from 'react';
import { motion } from 'motion/react';

interface SkeletonLoaderProps {
  variant?: 'text' | 'card' | 'avatar' | 'chart' | 'table';
  lines?: number;
  className?: string;
  animate?: boolean;
}

export function SkeletonLoader({ 
  variant = 'text', 
  lines = 3, 
  className = '',
  animate = true 
}: SkeletonLoaderProps) {
  const prefersReducedMotion = typeof window !== 'undefined' && 
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const shimmerAnimation = {
    initial: { x: '-100%' },
    animate: { x: '100%' },
    transition: {
      duration: prefersReducedMotion ? 0 : 1.5,
      repeat: animate ? Infinity : 0,
      ease: 'easeInOut'
    }
  };

  const SkeletonBase = ({ children, className, style }: { children?: React.ReactNode; className?: string; style?: React.CSSProperties }) => (
    <div className={`relative overflow-hidden bg-muted rounded-md ${className}`} style={style}>
      {children}
      {animate && !prefersReducedMotion && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-background/50 to-transparent"
          {...shimmerAnimation}
        />
      )}
    </div>
  );

  switch (variant) {
    case 'text':
      return (
        <div className={`space-y-2 ${className}`}>
          {Array.from({ length: lines }).map((_, i) => (
            <SkeletonBase
              key={i}
              className={`h-4 ${i === lines - 1 ? 'w-3/4' : 'w-full'}`}
            />
          ))}
        </div>
      );

    case 'card':
      return (
        <div className={`space-y-4 p-6 border rounded-lg ${className}`}>
          <SkeletonBase className="h-6 w-1/2" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonBase
                key={i}
                className={`h-4 ${i === 2 ? 'w-3/4' : 'w-full'}`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <SkeletonBase className="h-8 w-20" />
            <SkeletonBase className="h-8 w-16" />
          </div>
        </div>
      );

    case 'avatar':
      return (
        <div className={`flex items-center gap-3 ${className}`}>
          <SkeletonBase className="h-10 w-10 rounded-full" />
          <div className="space-y-2 flex-1">
            <SkeletonBase className="h-4 w-24" />
            <SkeletonBase className="h-3 w-16" />
          </div>
        </div>
      );

    case 'chart':
      return (
        <div className={`space-y-4 ${className}`}>
          <SkeletonBase className="h-6 w-32" />
          <div className="h-64 flex items-end gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonBase
                key={i}
                className="flex-1"
                style={{ height: `${Math.random() * 80 + 20}%` }}
              />
            ))}
          </div>
        </div>
      );

    case 'table':
      return (
        <div className={`space-y-2 ${className}`}>
          <div className="flex gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonBase key={i} className="h-8 flex-1" />
            ))}
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              {Array.from({ length: 4 }).map((_, j) => (
                <SkeletonBase key={j} className="h-6 flex-1" />
              ))}
            </div>
          ))}
        </div>
      );

    default:
      return <SkeletonBase className={`h-4 w-full ${className}`} />;
  }
}