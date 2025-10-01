import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import prisma from '@/lib/prisma';
import { getUserDataByMode } from '@/lib/user-mode-utils';
import { notificationService, NotificationType, NotificationPriority } from '@/lib/notification-service';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: reportId } = await params;

    // Получаем отчет с учетом режима пользователя (demo/paid)
    const report = await getUserDataByMode('reports', async () => {
      // Реальные данные для PAID режима
      const user = await prisma.user.findUnique({
        where: { email: session.user!.email! },
        select: { id: true }
      });

      if (!user) {
        throw new Error('User not found');
      }

      const report = await prisma.report.findFirst({
        where: {
          id: reportId,
          userId: user.id
        },
        include: {
          document: {
            select: {
              id: true,
              fileName: true,
              fileSize: true,
              category: true
            }
          }
        }
      });

      if (!report) {
        return null;
      }

      return {
        id: report.id,
        name: report.name,
        type: report.reportType === 'REPORT_296FZ' ? '296-ФЗ Годовой' : report.reportType,
        period: report.period,
        status: report.status.toLowerCase(),
        createdDate: report.createdAt.toLocaleDateString('ru-RU'),
        submissionDeadline: report.submissionDeadline?.toLocaleDateString('ru-RU') || '',
        totalEmissions: report.totalEmissions || 0,
        documentCount: report.documentCount,
        emissionData: report.emissionData,
        methodology: report.methodology,
        version: report.version,
        downloadCount: report.downloadCount,
        lastDownload: report.lastDownload?.toLocaleDateString('ru-RU'),
        documents: report.document ? [report.document] : []
      };
    });

    if (!report) {
      // В демо-режиме ищем в моковых данных
      const demoReports = await getUserDataByMode('reports', async () => []);
      const demoReport = demoReports.find((r: any) => r.id === reportId);

      if (!demoReport) {
        return NextResponse.json({ error: 'Report not found' }, { status: 404 });
      }

      return NextResponse.json({
        ...demoReport,
        emissionData: {
          scope1: 497.2,
          scope2: 750.6,
          scope3: 0,
          total: demoReport.totalEmissions
        },
        methodology: '296-ФЗ от 02.07.2021',
        version: 1,
        downloadCount: 0,
        documents: []
      });
    }

    return NextResponse.json(report);

  } catch (error) {
    console.error('Error fetching report details:', error);
    return NextResponse.json({ error: 'Failed to fetch report details' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // В демо-режиме обновление недоступно
    const isDemo = await getUserDataByMode('reports', async () => false);
    if (isDemo !== false) {
      return NextResponse.json(
        { error: 'Updating reports is not available in demo mode' },
        { status: 403 }
      );
    }

    const reportId = params.id;
    const body = await request.json();
    const { name, status, totalEmissions, emissionData } = body;

    const user = await prisma.user.findUnique({
      where: { email: session.user!.email! },
      select: { id: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Проверяем что отчет принадлежит пользователю
    const existingReport = await prisma.report.findFirst({
      where: {
        id: reportId,
        userId: user.id
      }
    });

    if (!existingReport) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // Обновляем отчет
    const allowedStatuses = ['DRAFT', 'READY'];
    const updateData: any = {};

    if (name) updateData.name = name;
    if (status && allowedStatuses.includes(status.toUpperCase())) {
      updateData.status = status.toUpperCase();
    }
    if (totalEmissions !== undefined) updateData.totalEmissions = totalEmissions;
    if (emissionData) updateData.emissionData = emissionData;

    const updatedReport = await prisma.report.update({
      where: { id: reportId },
      data: updateData,
      select: {
        id: true,
        name: true,
        reportType: true,
        status: true,
        period: true,
        submissionDeadline: true,
        totalEmissions: true,
        documentCount: true,
        createdAt: true,
        updatedAt: true
      }
    });

    // Отправляем уведомление если статус изменился на READY
    if (status && status.toUpperCase() === 'READY' && existingReport.status !== 'READY') {
      try {
        await notificationService.sendNotification({
          userId: user.id,
          type: NotificationType.REPORT_READY,
          title: 'Отчёт готов к отправке',
          message: `Отчёт "${updatedReport.name}" готов к отправке в регулятор. Проверьте данные перед отправкой.`,
          metadata: {
            reportId: updatedReport.id,
            reportName: updatedReport.name,
            reportType: updatedReport.reportType === 'REPORT_296FZ' ? '296-ФЗ Годовой' : updatedReport.reportType,
            totalEmissions: updatedReport.totalEmissions,
            link: `/reports/${updatedReport.id}`,
            priority: NotificationPriority.MEDIUM
          }
        });
        console.log(`✅ Уведомление о готовности отчёта отправлено: ${updatedReport.id}`);
      } catch (notifError) {
        console.error('❌ Не удалось отправить уведомление о готовности отчёта:', notifError);
        // Не прерываем выполнение если уведомление не отправилось
      }
    }

    return NextResponse.json({
      id: updatedReport.id,
      name: updatedReport.name,
      type: updatedReport.reportType === 'REPORT_296FZ' ? '296-ФЗ Годовой' : updatedReport.reportType,
      period: updatedReport.period,
      status: updatedReport.status.toLowerCase(),
      createdDate: updatedReport.createdAt.toLocaleDateString('ru-RU'),
      submissionDeadline: updatedReport.submissionDeadline?.toLocaleDateString('ru-RU') || '',
      totalEmissions: updatedReport.totalEmissions || 0,
      documentCount: updatedReport.documentCount
    });

  } catch (error) {
    console.error('Error updating report:', error);
    return NextResponse.json({ error: 'Failed to update report' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // В демо-режиме удаление недоступно
    const isDemo = await getUserDataByMode('reports', async () => false);
    if (isDemo !== false) {
      return NextResponse.json(
        { error: 'Deleting reports is not available in demo mode' },
        { status: 403 }
      );
    }

    const reportId = params.id;

    const user = await prisma.user.findUnique({
      where: { email: session.user!.email! },
      select: { id: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Проверяем что отчет принадлежит пользователю и можно удалить (только черновики)
    const existingReport = await prisma.report.findFirst({
      where: {
        id: reportId,
        userId: user.id,
        status: 'DRAFT' // Можно удалять только черновики
      }
    });

    if (!existingReport) {
      return NextResponse.json(
        { error: 'Report not found or cannot be deleted' },
        { status: 404 }
      );
    }

    // Удаляем отчет
    await prisma.report.delete({
      where: { id: reportId }
    });

    return NextResponse.json({ message: 'Report deleted successfully' });

  } catch (error) {
    console.error('Error deleting report:', error);
    return NextResponse.json({ error: 'Failed to delete report' }, { status: 500 });
  }
}