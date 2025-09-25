import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ESG-Лайт — Автоматизация отчетности 296-ФЗ',
  description: 'Российская B2B SaaS платформа для автоматизации углеродной отчетности',
  keywords: ['ESG', 'углеродная отчетность', '296-ФЗ', 'CBAM', 'Россия'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  )
}