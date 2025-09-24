import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { signReportAndFreeze } from '@/lib/report-signing';
import { getUserInternalId } from '@/lib/user-utils';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (String(process.env.ENABLE_REPORT_SIGNING).toLowerCase() !== 'true') {
      // Фича отключена — ведём себя как будто маршрута нет
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    // Приводим Next Auth ID к внутреннему ID пользователя из БД
    const internalUserId = await getUserInternalId();
    const result = await signReportAndFreeze({ reportId: id, userId: internalUserId });

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('sign-report error:', error);
    return NextResponse.json(
      { error: error?.message || 'Ошибка подписания отчета' },
      { status: 400 }
    );
  }
}


