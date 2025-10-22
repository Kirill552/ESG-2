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
      select: {
        id: true,
        organization: {
          select: {
            id: true,
            canGenerate296FZ: true,
            reportsPerMonth: true,
            isBlocked: true
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Проверяем доступ организации к генерации отчетов
    if (user.organization) {
      // Проверяем блокировку организации
      if (user.organization.isBlocked) {
        return NextResponse.json(
          { error: 'Организация заблокирована. Обратитесь в службу поддержки.' },
          { status: 403 }
        );
      }

      // Проверяем флаг доступа к генерации отчетов 296-ФЗ
      if (!user.organization.canGenerate296FZ) {
        return NextResponse.json(
          { error: 'Генерация отчетов 296-ФЗ недоступна для вашей организации. Обратитесь к администратору.' },
          { status: 403 }
        );
      }

      // Проверяем лимит отчетов в месяц (если установлен)
      if (user.organization.reportsPerMonth > 0) {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

        const reportsThisMonth = await prisma.report.count({
          where: {
            userId: user.id,
            createdAt: {
              gte: startOfMonth,
              lte: endOfMonth,
            },
          },
        });

        if (reportsThisMonth >= user.organization.reportsPerMonth) {
          return NextResponse.json(
            {
              error: `Достигнут лимит генерации отчетов (${user.organization.reportsPerMonth} в месяц). Обратитесь к администратору для увеличения лимита.`,
            },
            { status: 403 }
          );
        }
      }
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
    // Фильтруем по ИНН: включаем только документы где ИНН совпадает (true) или не распознан (null)
    // Исключаем документы с чужим ИНН (innMatches: false)
    const processedDocuments = await prisma.document.findMany({
      where: {
        userId: user.id,
        status: 'PROCESSED',
        OR: [
          { innMatches: true },   // Документы с совпадающим ИНН
          { innMatches: null },   // Документы без распознанного ИНН
        ]
      },
      select: {
        id: true,
        ocrData: true,
        extractedINN: true,
        innMatches: true
      }
    });

    console.log(`📊 Отфильтровано документов для отчета: ${processedDocuments.length}`);
    console.log(`   - С совпадающим ИНН: ${processedDocuments.filter(d => d.innMatches === true).length}`);
    console.log(`   - Без ИНН: ${processedDocuments.filter(d => d.innMatches === null).length}`);

    // Подсчитываем выбросы из документов
    let totalEmissions = 0;
    processedDocuments.forEach(doc => {
      if (doc.ocrData && typeof doc.ocrData === 'object') {
        const data = doc.ocrData as any;

        // НОВАЯ ЛОГИКА: Проверяем данные транспорта из extractedData
        if (data.extractedData?.transport?.analysis?.emissions) {
          const transportEmissions = data.extractedData.transport.analysis.emissions.co2Emissions;
          console.log(`🚗 Транспортные выбросы из документа ${doc.id}: ${transportEmissions} кг CO₂`);
          totalEmissions += transportEmissions / 1000; // переводим кг в тонны
        }
        // СТАРАЯ ЛОГИКА: Ищем числовые значения в других полях (для других категорий)
        else if (data.emissions) {
          totalEmissions += Number(data.emissions) || 0;
        }
        else if (data.co2) {
          totalEmissions += Number(data.co2) || 0;
        }
        else if (data.carbon) {
          totalEmissions += Number(data.carbon) || 0;
        }
        // Проверяем структурированные данные из парсеров (Excel, CSV)
        else if (data.extractedData?.fuel) {
          // TODO: Рассчитать выбросы из данных о топливе
          console.log(`⚠️ Обнаружены данные о топливе для документа ${doc.id}, но расчет выбросов еще не реализован`);
        }
        else {
          console.warn(`⚠️ Документ ${doc.id} (${data.category || 'Неизвестно'}) не содержит данных о выбросах`);
        }
      }
    });

    console.log(`📊 Общие выбросы для отчета: ${totalEmissions.toFixed(3)} тонн CO₂ из ${processedDocuments.length} документов`);

    // Рассчитываем отчетный период (по умолчанию: календарный год)
    const year = parseInt(period || new Date().getFullYear().toString());
    const reportPeriodStart = new Date(year, 0, 1); // 1 января
    const reportPeriodEnd = new Date(year, 11, 31, 23, 59, 59); // 31 декабря

    console.log(`📅 Отчетный период: с ${reportPeriodStart.toLocaleDateString('ru-RU')} по ${reportPeriodEnd.toLocaleDateString('ru-RU')}`);

    // Создаем новый отчет
    const report = await prisma.report.create({
      data: {
        userId: user.id,
        name,
        reportType: reportType === 'annual' ? 'REPORT_296FZ' : 'REPORT_296FZ',
        period,
        reportPeriodStart,
        reportPeriodEnd,
        status: 'READY',
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
        reportPeriodStart: true,
        reportPeriodEnd: true,
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