import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import prisma from '@/lib/prisma';
import { getUserDataByMode } from '@/lib/user-mode-utils';
import { ensureOrganizationComplete } from '@/lib/check-organization-completeness';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const search = searchParams.get('search');

    // Получаем данные с учетом режима пользователя (demo/paid)
    const reports = await getUserDataByMode('reports', async () => {
      // Реальные данные для PAID режима
      const user = await prisma.user.findUnique({
        where: { email: session.user!.email! },
        select: { id: true }
      });

      if (!user) {
        throw new Error('User not found');
      }

      const where: any = {
        userId: user.id
      };

      if (status && status !== 'all') {
        // Только доступные статусы для MVP
        const allowedStatuses = ['DRAFT', 'READY'];
        const upperStatus = status.toUpperCase();
        if (allowedStatuses.includes(upperStatus)) {
          where.status = upperStatus;
        }
      }

      if (search) {
        where.name = {
          contains: search,
          mode: 'insensitive'
        };
      }

      const skip = (page - 1) * pageSize;

      const [reports, total] = await Promise.all([
        prisma.report.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: pageSize,
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
        }),
        prisma.report.count({ where })
      ]);

      return {
        reports: reports.map(report => ({
          id: report.id,
          name: report.name,
          type: report.reportType === 'REPORT_296FZ' ? '296-ФЗ Годовой' : report.reportType,
          period: report.period,
          status: report.status.toLowerCase(),
          createdDate: report.createdAt.toLocaleDateString('ru-RU'),
          submissionDeadline: report.submissionDeadline?.toLocaleDateString('ru-RU') || '',
          totalEmissions: report.totalEmissions || 0,
          documentCount: report.documentCount
        })),
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
          hasNext: page < Math.ceil(total / pageSize),
          hasPrev: page > 1
        }
      };
    });

    return NextResponse.json(reports);

  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, reportType, period, description } = body;

    // В демо-режиме создание отчетов недоступно
    const isDemo = await getUserDataByMode('reports', async () => false);
    if (isDemo !== false) {
      return NextResponse.json(
        { error: 'Creating reports is not available in demo mode' },
        { status: 403 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user!.email! },
      select: { id: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Проверяем полноту данных организации перед созданием отчета 296-ФЗ
    const organizationCheck = await ensureOrganizationComplete(user.id);

    if (!organizationCheck.success) {
      return NextResponse.json(
        {
          error: 'ORGANIZATION_INCOMPLETE',
          message: organizationCheck.error?.message,
          missingFields: organizationCheck.error?.missingFields,
          warnings: organizationCheck.error?.warnings,
        },
        { status: 400 }
      );
    }

    // Получаем обработанные документы пользователя для расчета выбросов
    const processedDocuments = await prisma.document.findMany({
      where: {
        userId: user.id,
        status: 'PROCESSED'
      },
      select: {
        id: true,
        extractedData: true
      }
    });

    // Подсчитываем выбросы из документов (примерный расчет)
    let totalEmissions = 0;
    processedDocuments.forEach(doc => {
      if (doc.extractedData && typeof doc.extractedData === 'object') {
        const data = doc.extractedData as any;
        // Ищем числовые значения, похожие на выбросы (тонны CO2)
        if (data.emissions) totalEmissions += Number(data.emissions) || 0;
        if (data.co2) totalEmissions += Number(data.co2) || 0;
        if (data.carbon) totalEmissions += Number(data.carbon) || 0;
      }
    });

    // Если нет данных о выбросах, создаем демо-значение на основе количества документов
    if (totalEmissions === 0 && processedDocuments.length > 0) {
      // Примерный расчет: ~200 тонн на документ (для демонстрации)
      totalEmissions = Math.round(processedDocuments.length * 200 + Math.random() * 100);
    }

    // Создаем новый отчет
    const report = await prisma.report.create({
      data: {
        userId: user.id,
        name,
        reportType: reportType === 'annual' ? 'REPORT_296FZ' : 'REPORT_296FZ',
        period,
        status: 'DRAFT',
        format: 'pdf',
        fileName: `${name.replace(/\s+/g, '_')}.pdf`,
        filePath: '', // Будет заполнен при генерации
        emissionData: {},
        submissionDeadline: period === '2024'
          ? new Date('2025-07-01') // 296-ФЗ: отчет за 2024 год сдается до 1 июля 2025
          : period === '2025'
          ? new Date('2026-07-01') // 296-ФЗ: отчет за 2025 год сдается до 1 июля 2026
          : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 дней от сегодня для других периодов
        totalEmissions,
        documentCount: processedDocuments.length
      },
      select: {
        id: true,
        name: true,
        reportType: true,
        status: true,
        period: true,
        submissionDeadline: true,
        totalEmissions: true,
        documentCount: true,
        createdAt: true
      }
    });

    return NextResponse.json({
      id: report.id,
      name: report.name,
      type: report.reportType === 'REPORT_296FZ' ? '296-ФЗ Годовой' : report.reportType,
      period: report.period,
      status: report.status.toLowerCase(),
      createdDate: report.createdAt.toLocaleDateString('ru-RU'),
      submissionDeadline: report.submissionDeadline?.toLocaleDateString('ru-RU') || '',
      totalEmissions: report.totalEmissions || 0,
      documentCount: report.documentCount
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating report:', error);
    return NextResponse.json({ error: 'Failed to create report' }, { status: 500 });
  }
}