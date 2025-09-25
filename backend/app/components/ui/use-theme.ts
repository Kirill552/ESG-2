import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'eco' | 'high-contrast' | 'system';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
  const stored = localStorage.getItem('esg-lite-theme') as Theme;
    if (stored) {
      setTheme(stored);
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.className = systemTheme;
    } else {
      root.className = theme;
    }
    
  localStorage.setItem('esg-lite-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => {
      switch (prev) {
        case 'light':
          return 'dark';
        case 'dark':
          return 'eco';
        case 'eco':
          return 'high-contrast';
        case 'high-contrast':
          return 'system';
        default:
          return 'light';
      }
    });
  };

  return {
    theme,
    setTheme,
    toggleTheme
  };
}
