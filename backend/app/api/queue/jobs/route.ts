import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getQueueManager } from '../../../../lib/queue';

/**
 * Получение списка задач в очереди
 * GET /api/queue/jobs?limit=20&type=active|failed|all
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    
    if (!session?.user?.id || !userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const type = url.searchParams.get('type') || 'all';

  const queueManager = await getQueueManager();

    let jobs = [];

    try {
      if (type === 'active') {
        jobs = await queueManager.getActiveJobs(limit);
      } else if (type === 'failed') {
        jobs = await queueManager.getFailedJobs(limit);
      } else {
        // Получаем смесь активных и неудачных задач
        const [activeJobs, failedJobs] = await Promise.all([
          queueManager.getActiveJobs(limit / 2),
          queueManager.getFailedJobs(limit / 2)
        ]);
        jobs = [...activeJobs, ...failedJobs];
      }

      return NextResponse.json({
        success: true,
        data: {
          jobs,
          total: jobs.length,
          type
        }
      });

    } catch (queueError) {
      throw queueError;
    }

  } catch (error) {
    console.error('❌ Queue jobs error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get queue jobs',
        data: { jobs: [], total: 0 }
      },
      { status: 500 }
    );
  }
}

