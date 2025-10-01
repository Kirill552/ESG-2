// Убрал 'server-only' для совместимости с worker
import { PrismaClient } from '@prisma/client'
import { encryptionMiddleware } from './prisma-encryption-middleware'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
  })

// Добавляем улучшенный middleware для автоматического шифрования/дешифрования (с защитой для моков в тестах)
if (typeof (prisma as any).$use === 'function') {
  prisma.$use(encryptionMiddleware)
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Graceful shutdown - корректное закрытие соединений
// Проверяем, что мы не в Edge Runtime
if (typeof process !== 'undefined' && process.on) {
  process.on('beforeExit', async () => {
    await prisma.$disconnect()
  })
}

export default prisma