'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle, AlertTriangle } from 'lucide-react';
import { Button } from './button';
import { useToast, useToasts } from '@/lib/hooks/use-toast';

export function Toaster() {
  const toasts = useToasts();
  const { dismiss } = useToast();

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.9 }}
            className="mb-3 pointer-events-auto"
          >
            <div
              className={`
                rounded-lg shadow-lg border p-4 bg-white
                ${toast.variant === 'destructive'
                  ? 'border-red-200 bg-red-50'
                  : 'border-gray-200 bg-white'
                }
              `}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  {toast.variant === 'destructive' ? (
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3
                    className={`
                      text-sm font-medium
                      ${toast.variant === 'destructive'
                        ? 'text-red-800'
                        : 'text-gray-900'
                      }
                    `}
                  >
                    {toast.title}
                  </h3>
                  {toast.description && (
                    <p
                      className={`
                        text-sm mt-1
                        ${toast.variant === 'destructive'
                          ? 'text-red-700'
                          : 'text-gray-600'
                        }
                      `}
                    >
                      {toast.description}
                    </p>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="w-6 h-6 flex-shrink-0"
                  onClick={() => dismiss(toast.id)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}