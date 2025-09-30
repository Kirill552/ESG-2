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
          ? new Date('2025-03-31')
          : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 дней от сегодня
        totalEmissions: 0,
        documentCount: 0
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