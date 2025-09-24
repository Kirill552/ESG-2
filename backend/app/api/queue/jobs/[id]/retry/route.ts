import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getQueueManager } from '../../../../../../lib/queue';

/**
 * Повторная попытка выполнения задачи
 * POST /api/queue/jobs/[id]/retry
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

      if (jobStatus.status !== 'failed') {
        return NextResponse.json(
          { success: false, error: 'Can only retry failed jobs' },
          { status: 400 }
        );
      }

      // Используем pg-boss для повторной попытки
      const boss = (queueManager as any).boss;
      if (boss && boss.retry) {
        const newJobId = await boss.retry(jobId);
        console.log(`✅ Задача ${jobId} перезапущена с новым ID: ${newJobId}`);
        
        return NextResponse.json({
          success: true,
          message: 'Job retry scheduled successfully',
          data: { 
            originalJobId: jobId,
            newJobId: newJobId || jobId
          }
        });
      } else {
        // Fallback: получаем оригинальную задачу из БД для создания новой
        return NextResponse.json({
          success: false,
          error: 'Cannot retry job: pg-boss retry method not available',
          message: 'Please create a new task manually'
        }, { status: 501 });
      }

    } catch (queueError) {
      throw queueError;
    }

  } catch (error) {
    console.error(`❌ Retry job ${params.id} error:`, error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to retry job'
      },
      { status: 500 }
    );
  }
}
