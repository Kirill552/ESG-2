import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import prisma from '@/lib/prisma';
import { getUserDataByMode } from '@/lib/user-mode-utils';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: reportId } = await params;

    // В демо-режиме отправка недоступна
    const isDemo = await getUserDataByMode('reports', async () => false);
    if (isDemo !== false) {
      return NextResponse.json(
        {
          error: 'Report submission is not available in demo mode',
          message: 'This feature will be available after getting access to the full version'
        },
        { status: 403 }
      );
    }

    // TODO: Для будущих улучшений - отправка в регулятор
    // Эта функциональность будет реализована в следующих версиях
    return NextResponse.json(
      {
        error: 'Report submission to regulatory authorities is not implemented yet',
        message: 'This feature is planned for future releases and will include integration with official Russian reporting systems according to 296-FZ legislation',
        reportId,
        plannedFeatures: [
          'Integration with government reporting systems',
          'Automatic status tracking (SUBMITTED, APPROVED)',
          'Notifications about review results',
          'Digital signature support',
          'Retry mechanism for failed submissions'
        ]
      },
      { status: 501 } // Not Implemented
    );

    // БУДУЩАЯ РЕАЛИЗАЦИЯ (когда будет интеграция с регулятором):
    /*
    const user = await prisma.user.findUnique({
      where: { email: session.user!.email! },
      select: { id: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Проверяем что отчет принадлежит пользователю
    const report = await prisma.report.findFirst({
      where: {
        id: reportId,
        userId: user.id
      }
    });

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // Проверяем что отчет готов к отправке
    if (report.status !== 'READY') {
      return NextResponse.json(
        { error: 'Report must be in READY status before submission' },
        { status: 400 }
      );
    }

    try {
      // Отправляем в регулятор
      const regulatoryService = new RegulatorySubmissionService();
      const submissionResult = await regulatoryService.submit296FZReport(report);

      // Обновляем статус отчета
      await prisma.report.update({
        where: { id: reportId },
        data: {
          status: 'SUBMITTED',
          // Добавляем поля для отслеживания отправки
          submittedAt: new Date(),
          submissionId: submissionResult.submissionId,
          regulatoryTrackingNumber: submissionResult.trackingNumber
        }
      });

      return NextResponse.json({
        message: 'Report successfully submitted to regulatory authority',
        submissionId: submissionResult.submissionId,
        trackingNumber: submissionResult.trackingNumber,
        estimatedProcessingTime: '5-10 business days'
      });

    } catch (error) {
      console.error('Error submitting to regulatory authority:', error);
      return NextResponse.json(
        { error: 'Failed to submit report to regulatory authority' },
        { status: 500 }
      );
    }
    */

  } catch (error) {
    console.error('Error in report submission:', error);
    return NextResponse.json({ error: 'Failed to process submission request' }, { status: 500 });
  }
}