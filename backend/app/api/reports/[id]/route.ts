import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { signReportAndFreeze } from '@/lib/report-signing';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

const prisma = new PrismaClient();

// GET - получение отчета по ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const report = await prisma.report.findUnique({
      where: {
        id: id,
        userId: userId
      },
      include: {
        document: true,
        user: true
      }
    });

    if (!report) {
      return NextResponse.json({ error: 'Отчет не найден' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: report
    });

  } catch (error) {
    console.error('Error fetching report:', error);
    return NextResponse.json(
      { error: 'Ошибка получения отчета' },
      { status: 500 }
    );
  }
}

// DELETE - удаление отчета
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Проверяем, что отчет принадлежит пользователю и узнаём состояние подписи/блокировки
    const report = await prisma.report.findFirst({
      where: { id, userId },
      select: { id: true, isLocked: true, signedAt: true, currentSnapshotId: true }
    });

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // Разрешаем удаление, если отчёт не подписан (т.е. нет signedAt и нет snapshot)
    const isSigned = Boolean(report.signedAt) || Boolean(report.currentSnapshotId);
    console.log(`🗑️ DELETE report ${id} — state: { isLocked: ${report.isLocked}, signedAt: ${report.signedAt ? 'yes' : 'no'}, hasSnapshot: ${report.currentSnapshotId ? 'yes' : 'no'} }`);
    if (isSigned) {
      // Мягкое удаление: архивируем подписанный отчёт
      await prisma.report.update({ where: { id }, data: { archivedAt: new Date() } as any });
      console.log(`🗄️ Report archived (soft-delete): ${id}`);
      return new NextResponse(null, { status: 204 });
    }

    // Жёсткое удаление для неподписанных
    await prisma.report.delete({ where: { id } });

    console.log(`🗑️ Отчет удален: ${id}`);

  return new NextResponse(null, { status: 204 });

  } catch (error) {
    console.error('Ошибка удаления отчета:', error);
    return NextResponse.json(
      { error: 'Ошибка удаления отчета' },
      { status: 500 }
    );
  }
} 

// POST /api/reports/[id]/sign — подписать и заморозить отчет
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (String(process.env.ENABLE_REPORT_SIGNING).toLowerCase() !== 'true') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const result = await signReportAndFreeze({ reportId: id, userId });

    return NextResponse.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Ошибка подписания отчета' },
      { status: 400 }
    );
  }
}