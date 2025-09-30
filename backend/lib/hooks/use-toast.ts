'use client';

import { useState, useCallback } from 'react';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
}

const INITIAL_STATE: ToastState = {
  toasts: [],
};

let state = INITIAL_STATE;
const listeners: Array<(state: ToastState) => void> = [];

function dispatch(action: ToastAction) {
  switch (action.type) {
    case 'ADD_TOAST':
      state = {
        ...state,
        toasts: [...state.toasts, action.toast],
      };
      break;
    case 'REMOVE_TOAST':
      state = {
        ...state,
        toasts: state.toasts.filter((toast) => toast.id !== action.id),
      };
      break;
    case 'CLEAR_TOASTS':
      state = {
        ...state,
        toasts: [],
      };
      break;
  }

  listeners.forEach((listener) => {
    listener(state);
  });
}

type ToastAction =
  | { type: 'ADD_TOAST'; toast: Toast }
  | { type: 'REMOVE_TOAST'; id: string }
  | { type: 'CLEAR_TOASTS' };

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

export function useToast() {
  const [, forceUpdate] = useState({});

  const subscribe = useCallback((listener: (state: ToastState) => void) => {
    listeners.push(listener);
    return () => {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, []);

  const toast = useCallback(
    ({
      title,
      description,
      variant = 'default',
      duration = 5000,
    }: Omit<Toast, 'id'>) => {
      const id = generateId();
      const newToast: Toast = {
        id,
        title,
        description,
        variant,
        duration,
      };

      dispatch({ type: 'ADD_TOAST', toast: newToast });

      // Автоматическое удаление через duration
      if (duration > 0) {
        setTimeout(() => {
          dispatch({ type: 'REMOVE_TOAST', id });
        }, duration);
      }

      return id;
    },
    []
  );

  const dismiss = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_TOAST', id });
  }, []);

  const clear = useCallback(() => {
    dispatch({ type: 'CLEAR_TOASTS' });
  }, []);

  return {
    toast,
    dismiss,
    clear,
    toasts: state.toasts,
    subscribe,
  };
}

// Hook для получения списка тостов (для компонента Toaster)
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>(state.toasts);

  const { subscribe } = useToast();

  useState(() => {
    const unsubscribe = subscribe((newState) => {
      setToasts(newState.toasts);
    });
    return unsubscribe;
  });

  return toasts;
}