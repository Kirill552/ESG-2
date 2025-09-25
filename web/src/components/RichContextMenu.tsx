import React from 'react';
import { motion } from 'motion/react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from './ui/context-menu';
import { cn } from './ui/utils';

interface MenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  onClick?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  submenu?: MenuItem[];
}

interface RichContextMenuProps {
  children: React.ReactNode;
  items: MenuItem[];
  title?: string;
  className?: string;
}

export function RichContextMenu({ 
  children, 
  items, 
  title,
  className = '' 
}: RichContextMenuProps) {
  const prefersReducedMotion = typeof window !== 'undefined' && 
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderMenuItem = (item: MenuItem) => {
    if (item.submenu) {
      return (
        <ContextMenuSub key={item.id}>
          <ContextMenuSubTrigger 
            className="flex items-center gap-2"
            disabled={item.disabled}
          >
            {item.icon && (
              <span className="w-4 h-4">{item.icon}</span>
            )}
            {item.label}
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {item.submenu.map(renderMenuItem)}
          </ContextMenuSubContent>
        </ContextMenuSub>
      );
    }

    return (
      <ContextMenuItem
        key={item.id}
        onClick={item.onClick}
        disabled={item.disabled}
        className={`
          flex items-center gap-2 cursor-pointer
          ${item.destructive ? 'text-destructive focus:text-destructive' : ''}
        `}
      >
        {item.icon && (
          <motion.span 
            className="w-4 h-4"
            whileHover={!prefersReducedMotion ? { scale: 1.1 } : undefined}
            transition={{ duration: 0.2 }}
          >
            {item.icon}
          </motion.span>
        )}
        <span className="flex-1">{item.label}</span>
        {item.shortcut && (
          <ContextMenuShortcut>{item.shortcut}</ContextMenuShortcut>
        )}
      </ContextMenuItem>
    );
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger className={className}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent 
        className="w-64"
        asChild
      >
        <motion.div
          className={cn(
            prefersReducedMotion ? "" : "will-change-transform",
          )}
          style={{ marginLeft: '0.75rem', marginTop: '0.5rem' }}
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          transition={{ 
            duration: prefersReducedMotion ? 0 : 0.2,
            ease: 'easeOut'
          }}
        >
          {title && (
            <>
              <ContextMenuLabel className="font-medium text-foreground">
                {title}
              </ContextMenuLabel>
              <ContextMenuSeparator />
            </>
          )}
          {items.map(renderMenuItem)}
        </motion.div>
      </ContextMenuContent>
    </ContextMenu>
  );
}

// Специализированные контекстные меню для разных разделов

interface DocumentContextMenuProps {
  children: React.ReactNode;
  onView: () => void;
  onDownload: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onShare?: () => void;
}

export function DocumentContextMenu({
  children,
  onView,
  onDownload,
  onEdit,
  onDelete,
  onShare
}: DocumentContextMenuProps) {
  const items: MenuItem[] = [
    {
      id: 'view',
      label: 'Просмотреть',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      ),
      shortcut: 'Enter',
      onClick: onView
    },
    {
      id: 'download',
      label: 'Скачать',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      shortcut: 'Ctrl+D',
      onClick: onDownload
    },
    {
      id: 'edit',
      label: 'Редактировать',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
      shortcut: 'Ctrl+E',
      onClick: onEdit
    }
  ];

  if (onShare) {
    items.push({
      id: 'share',
      label: 'Поделиться',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
        </svg>
      ),
      onClick: onShare
    });
  }

  items.push({
    id: 'delete',
    label: 'Удалить',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    ),
    shortcut: 'Del',
    onClick: onDelete,
    destructive: true
  });

  return (
    <RichContextMenu
      items={items}
      title="Действия с документом"
    >
      {children}
    </RichContextMenu>
  );
}

interface ReportContextMenuProps {
  children: React.ReactNode;
  onView: () => void;
  onExport: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

export function ReportContextMenu({
  children,
  onView,
  onExport,
  onDuplicate,
  onArchive,
  onDelete
}: ReportContextMenuProps) {
  const items: MenuItem[] = [
    {
      id: 'view',
      label: 'Открыть отчет',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      onClick: onView
    },
    {
      id: 'export',
      label: 'Экспорт',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      submenu: [
        {
          id: 'export-pdf',
          label: 'PDF',
          onClick: () => onExport()
        },
        {
          id: 'export-excel',
          label: 'Excel',
          onClick: () => onExport()
        },
        {
          id: 'export-word',
          label: 'Word',
          onClick: () => onExport()
        }
      ]
    },
    {
      id: 'duplicate',
      label: 'Дублировать',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      ),
      onClick: onDuplicate
    },
    {
      id: 'archive',
      label: 'Архивировать',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8l6 6 6-6" />
        </svg>
      ),
      onClick: onArchive
    },
    {
      id: 'delete',
      label: 'Удалить',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      ),
      onClick: onDelete,
      destructive: true
    }
  ];

  return (
    <RichContextMenu
      items={items}
      title="Действия с отчетом"
    >
      {children}
    </RichContextMenu>
  );
}