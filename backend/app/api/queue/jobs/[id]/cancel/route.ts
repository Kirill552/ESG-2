import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getQueueManager } from '../../../../../../lib/queue';

/**
 * Отмена задачи в очереди
 * POST /api/queue/jobs/[id]/cancel
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    const jobId = params.id;
    if (!jobId) {
      return NextResponse.json(
        { success: false, error: 'Job ID is required' },
        { status: 400 }
      );
    }

  const queueManager = await getQueueManager();

    try {
      // Получаем информацию о задаче для проверки
      const jobStatus = await queueManager.getJobStatus(jobId);
      
      if (!jobStatus) {
        return NextResponse.json(
          { success: false, error: 'Job not found' },
          { status: 404 }
        );
      }

      if (jobStatus.status === 'completed') {
        return NextResponse.json(
          { success: false, error: 'Cannot cancel completed job' },
          { status: 400 }
        );
      }

      // Используем pg-boss для отмены задачи
      const boss = (queueManager as any).boss;
      if (boss && boss.cancel) {
        await boss.cancel(jobId);
        console.log(`✅ Задача ${jobId} отменена`);
      }

      return NextResponse.json({
        success: true,
        message: 'Job cancelled successfully',
        data: { jobId }
      });

    } catch (queueError) {
      throw queueError;
    }

  } catch (error) {
    console.error(`❌ Cancel job ${params.id} error:`, error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to cancel job'
      },
      { status: 500 }
    );
  }
}
