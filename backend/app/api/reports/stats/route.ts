import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import prisma from '@/lib/prisma';
import { getUserDataByMode } from '@/lib/user-mode-utils';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Получаем статистику с учетом режима пользователя (demo/paid)
    const stats = await getUserDataByMode('reports_stats', async () => {
      // Реальные данные для PAID режима
      const user = await prisma.user.findUnique({
        where: { email: session.user!.email! },
        select: { id: true }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Считаем статистику по отчетам пользователя
      const [
        total,
        readyToSend,
        completed,
        closeDeadlines
      ] = await Promise.all([
        // Общее количество отчетов
        prisma.report.count({
          where: { userId: user.id }
        }),

        // Готовы к отправке (статус READY)
        prisma.report.count({
          where: {
            userId: user.id,
            status: 'READY'
          }
        }),

        // Завершенные отчеты (статус READY для MVP)
        prisma.report.count({
          where: {
            userId: user.id,
            status: 'READY'
          }
        }),

        // Близкие дедлайны (в течение 7 дней)
        prisma.report.count({
          where: {
            userId: user.id,
            submissionDeadline: {
              gte: new Date(),
              lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 дней от сегодня
            },
            status: {
              in: ['DRAFT', 'READY'] // Только незавершенные отчеты
            }
          }
        })
      ]);

      return {
        total,
        ready_to_send: readyToSend,
        close_deadlines: closeDeadlines,
        approved: completed // Переименовано для обратной совместимости с UI
      };
    });

    return NextResponse.json(stats);

  } catch (error) {
    console.error('Error fetching reports stats:', error);
    return NextResponse.json({ error: 'Failed to fetch reports statistics' }, { status: 500 });
  }
}