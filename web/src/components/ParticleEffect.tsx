import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  duration: number;
}

interface ParticleEffectProps {
  trigger: boolean;
  onComplete?: () => void;
  variant?: 'success' | 'celebration' | 'eco' | 'upload';
  origin?: { x: number; y: number };
  particleCount?: number;
  className?: string;
}

export function ParticleEffect({
  trigger,
  onComplete,
  variant = 'success',
  origin = { x: 50, y: 50 },
  particleCount = 20,
  className = ''
}: ParticleEffectProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  
  const prefersReducedMotion = typeof window !== 'undefined' && 
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const variantConfig = {
    success: {
      colors: ['#10B981', '#059669', '#047857', '#065F46'],
      symbols: ['✓', '✨', '🎉'],
      duration: 2
    },
    celebration: {
      colors: ['#F59E0B', '#D97706', '#B45309', '#92400E'],
      symbols: ['🎉', '✨', '⭐', '🎊'],
      duration: 3
    },
    eco: {
      colors: ['#22C55E', '#16A34A', '#15803D', '#166534'],
      symbols: ['🌱', '🍃', '🌿', '♻️'],
      duration: 2.5
    },
    upload: {
      colors: ['#3B82F6', '#2563EB', '#1D4ED8', '#1E40AF'],
      symbols: ['📄', '📊', '📈', '✓'],
      duration: 2
    }
  };

  useEffect(() => {
    if (trigger && !prefersReducedMotion) {
      const config = variantConfig[variant];
      const newParticles: Particle[] = [];

      for (let i = 0; i < particleCount; i++) {
        newParticles.push({
          id: i,
          x: origin.x + (Math.random() - 0.5) * 20,
          y: origin.y + (Math.random() - 0.5) * 20,
          size: Math.random() * 12 + 8,
          color: config.colors[Math.floor(Math.random() * config.colors.length)],
          duration: config.duration + Math.random() * 0.5
        });
      }

      setParticles(newParticles);

      const timer = setTimeout(() => {
        setParticles([]);
        onComplete?.();
      }, config.duration * 1000 + 500);

      return () => clearTimeout(timer);
    }
  }, [trigger, variant, origin.x, origin.y, particleCount, onComplete, prefersReducedMotion]);

  if (prefersReducedMotion) {
    return null;
  }

  return (
    <div className={`fixed inset-0 pointer-events-none z-50 ${className}`}>
      <AnimatePresence>
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            className="absolute rounded-full"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: particle.size,
              height: particle.size,
              backgroundColor: particle.color
            }}
            initial={{
              scale: 0,
              opacity: 1,
              x: 0,
              y: 0
            }}
            animate={{
              scale: [0, 1, 0],
              opacity: [1, 0.8, 0],
              x: (Math.random() - 0.5) * 300,
              y: (Math.random() - 0.5) * 300 - 100,
              rotate: Math.random() * 360
            }}
            exit={{
              scale: 0,
              opacity: 0
            }}
            transition={{
              duration: particle.duration,
              ease: [0.25, 0.46, 0.45, 0.94]
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

// Специализированный компонент для успешных действий
interface SuccessParticlesProps {
  show: boolean;
  onComplete?: () => void;
  message?: string;
}

export function SuccessParticles({ show, onComplete, message }: SuccessParticlesProps) {
  return (
    <>
      <ParticleEffect
        trigger={show}
        variant="success"
        onComplete={onComplete}
        particleCount={15}
      />
      
      <AnimatePresence>
        {show && message && (
          <motion.div
            className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              className="bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg font-medium"
              initial={{ y: 50 }}
              animate={{ y: 0 }}
              exit={{ y: -50 }}
              transition={{ delay: 0.1 }}
            >
              {message}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// Компонент для эко-эффектов
export function EcoParticles({ show, onComplete }: { show: boolean; onComplete?: () => void }) {
  return (
    <ParticleEffect
      trigger={show}
      variant="eco"
      onComplete={onComplete}
      particleCount={25}
      origin={{ x: 50, y: 70 }}
    />
  );
}