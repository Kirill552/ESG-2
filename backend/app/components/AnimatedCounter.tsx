import React, { useEffect, useState } from 'react';
import { motion, useAnimation, useInView } from 'motion/react';

interface AnimatedCounterProps {
  value: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  className?: string;
  decimals?: number;
  formatNumber?: boolean;
}

export function AnimatedCounter({
  value,
  suffix = '',
  prefix = '',
  duration = 2,
  className = '',
  decimals = 0,
  formatNumber = true
}: AnimatedCounterProps) {
  const [count, setCount] = useState(0);
  const controls = useAnimation();
  const ref = React.useRef(null);
  const isInView = useInView(ref, { once: true });

  const prefersReducedMotion = typeof window !== 'undefined' && 
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (isInView) {
      const startTime = Date.now();
      const startValue = 0;
      const endValue = value;

      const animationDuration = prefersReducedMotion ? 0 : duration * 1000;

      const updateCounter = () => {
        const now = Date.now();
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / animationDuration, 1);
        
        // Easing function (ease-out)
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        
        const currentValue = startValue + (endValue - startValue) * easedProgress;
        setCount(currentValue);

        if (progress < 1) {
          requestAnimationFrame(updateCounter);
        }
      };

      updateCounter();

      // Trigger scale animation
      controls.start({
        scale: [1, 1.1, 1],
        transition: { 
          duration: prefersReducedMotion ? 0 : 0.6,
          ease: 'easeInOut'
        }
      });
    }
  }, [isInView, value, duration, controls, prefersReducedMotion]);

  const formatValue = (num: number) => {
    const rounded = Number(num.toFixed(decimals));
    
    if (!formatNumber) {
      return rounded.toString();
    }

    // Форматирование чисел для российской локали
    return new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(rounded);
  };

  return (
    <motion.span
      ref={ref}
      animate={controls}
      className={`inline-block tabular-nums ${className}`}
    >
      {prefix}
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: prefersReducedMotion ? 0 : 0.5 }}
      >
        {formatValue(count)}
      </motion.span>
      {suffix}
    </motion.span>
  );
}

// Специализированный компонент для экологических метрик
interface EcoMetricCounterProps {
  value: number;
  metric: 'co2' | 'energy' | 'waste' | 'water';
  className?: string;
}

export function EcoMetricCounter({ value, metric, className = '' }: EcoMetricCounterProps) {
  const metricConfig = {
    co2: { suffix: ' т CO₂', decimals: 2, color: 'text-red-600' },
    energy: { suffix: ' МВт·ч', decimals: 1, color: 'text-amber-600' },
    waste: { suffix: ' т', decimals: 1, color: 'text-orange-600' },
    water: { suffix: ' м³', decimals: 0, color: 'text-blue-600' }
  };

  const config = metricConfig[metric];

  return (
    <AnimatedCounter
      value={value}
      suffix={config.suffix}
      decimals={config.decimals}
      className={`${config.color} ${className}`}
      formatNumber={true}
    />
  );
}