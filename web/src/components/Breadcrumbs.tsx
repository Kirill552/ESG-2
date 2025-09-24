import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { motion } from 'motion/react';

interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
  isActive?: boolean;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  onHome: () => void;
}

export function Breadcrumbs({ items, onHome }: BreadcrumbsProps) {
  return (
    <motion.nav 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex items-center gap-2 px-6 py-4 text-sm text-muted-foreground"
    >
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onHome}
        className="flex items-center gap-1 hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted/50"
      >
        <Home className="w-4 h-4" />
        <span>Главная</span>
      </motion.button>
      
      {items.map((item, index) => (
        <React.Fragment key={index}>
          <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
          {item.onClick && !item.isActive ? (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={item.onClick}
              className="hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted/50"
            >
              {item.label}
            </motion.button>
          ) : (
            <span className={item.isActive ? 'text-foreground font-medium' : ''}>
              {item.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </motion.nav>
  );
}