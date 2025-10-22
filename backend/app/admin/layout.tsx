/**
 * Layout для админ-панели
 * Отдельный дизайн, sidebar навигация, header с профилем
 */

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ESG-Лайт — Админ-панель',
  description: 'Панель управления платформой ESG-Лайт',
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
