import { NextRequest, NextResponse } from 'next/server';
export const maxDuration = 600; // до 10 минут для тяжёлых генераций
import { PrismaClient, ReportType } from '@prisma/client';
import { loadMonetizationConfig } from '@/lib/monetization-config';
import { getToken } from 'next-auth/jwt';
import { getUserInternalId } from '@/lib/user-utils';
import { validateReportData } from '@/lib/report-validation';
import { generateReport, ReportGenerationData } from '@/lib/report-generator';
import { requireOrgRole } from '@/lib/rbac';

const prisma = new PrismaClient();

// GET - получение списка отчетов
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireOrgRole(['OWNER', 'ECOLOGIST', 'VIEWER', 'ACCOUNTANT']);
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Получаем внутренний ID пользователя
    const internalUserId = ctx.userIdInternal;

    // Проверяем существование пользователя
    const user = await prisma.user.findUnique({
      where: { id: internalUserId }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Пользователь не найден' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const locked = searchParams.get('locked');
    const page = Number(searchParams.get('page') || '0');
    const perPage = Number(searchParams.get('perPage') || '0');

  const where: any = { userId: internalUserId, archivedAt: null as any };
    if (locked === '1' || locked === 'true') {
      where.isLocked = true as any;
    }

    const query: any = {
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true }
        }
      }
    };
    if (page > 0 && perPage > 0) {
      query.skip = (page - 1) * perPage;
      query.take = perPage;
    }
    const reports = await prisma.report.findMany(query);

    return NextResponse.json(reports);
  } catch (error) {
    console.error('Ошибка получения отчетов:', error);
    
    if (error instanceof Error) {
      // Ошибки аутентификации пользователя
      if (error.message.includes('Не удалось получить данные пользователя')) {
        return NextResponse.json(
          { error: 'Ошибка аутентификации пользователя' },
          { status: 401 }
        );
      }

      // Ошибки базы данных
      if (error.message.includes('connection') || error.message.includes('timeout')) {
        return NextResponse.json(
          { error: 'Ошибка подключения к базе данных' },
          { status: 503 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}

// POST - создание отчета
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireOrgRole(['OWNER', 'ECOLOGIST']);
    if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    console.log('📋 Создание отчета:', body);

    // Валидация входных данных
    const validationErrors = validateReportData(body);
    if (validationErrors.length > 0) {
      return NextResponse.json(
        { 
          error: 'Ошибки валидации данных',
          details: validationErrors
        },
        { status: 400 }
      );
    }

    // Проверка лимита пробного плана (TRIAL): не более 1 отчёта за триальный период
    try {
      const subscription = await prisma.organization_subscriptions.findUnique({ where: { organizationId: ctx.organizationId } });
      const plan = (subscription?.plan_type || 'TRIAL') as 'TRIAL'|'LITE'|'STANDARD'|'LARGE'|'ENTERPRISE';
      if (plan === 'TRIAL') {
        const cfg = loadMonetizationConfig();
        const trialDays = cfg.trial.durationDays || 14;
        const maxReports = cfg.trial.maxReports || 1;
        let reportsCount = 0;
        if (subscription?.starts_at) {
          const periodStart = subscription.starts_at;
          const plannedEnd = new Date(periodStart.getTime() + trialDays * 24 * 60 * 60 * 1000);
          const periodEnd = plannedEnd.getTime() > Date.now() ? new Date() : plannedEnd;
          reportsCount = await prisma.report.count({
            where: {
              userId: ctx.userIdInternal,
              createdAt: { gte: periodStart, lte: periodEnd }
            }
          });
        } else {
          // Если нет starts_at — считаем с начала года
          const periodStart = new Date(new Date().getFullYear(), 0, 1);
          reportsCount = await prisma.report.count({
            where: {
              userId: ctx.userIdInternal,
              createdAt: { gte: periodStart }
            }
          });
        }
        if (reportsCount >= maxReports) {
          return NextResponse.json(
            { error: 'Лимит пробного плана: 1 отчёт' },
            { status: 403 }
          );
        }
      }
    } catch (e) {
      console.warn('TRIAL limit check failed (continue):', (e as any)?.message);
    }

    // Подготавливаем данные генерации
    const reportType = body.reportType === 'CBAM_QUARTERLY' ? 'CBAM' : '296-FZ';
    const companyData = body.companyData || body.emissionData || {};
    const signerData = body.signerData || {};
    const reportGenerationData: ReportGenerationData = {
      org_name: companyData.companyName || companyData.name || 'Не указано',
      org_address: companyData.address || 'Не указано',
      signer_name: signerData.name || 'Не указано',
      signer_position: signerData.position || 'Не указано',
      signer_pos: signerData.position || 'Не указано',
      sign_date: new Date().toLocaleDateString('ru-RU'),
      generation_date: new Date().toLocaleDateString('ru-RU'),
      generation_time: new Date().toLocaleTimeString('ru-RU'),
      document_id: `${reportType}_${Date.now()}`,
      org_inn: companyData.inn || 'Не указано',
      org_okpo: companyData.okpo || companyData.ogrn || 'Не указано',
      org_oktmo: companyData.oktmo || 'Не указано',
      org_phone: companyData.phone || 'Не указано',
      org_email: companyData.email || 'Не указано',
      report_year: companyData.reportingPeriod || body.reportPeriod || '2025',
      eori: companyData.eori || 'RU000000000000000',
      cbam_id: companyData.cbamId || 'DL-2025-000000',
      org_country: companyData.country || 'RU',
      report_year_q: body.reportPeriod || '2025-2',
      ...body.emissionData,
      ...body.goodsData
    };

    // Генерируем отчет до транзакции
    const generationResult = await generateReport(reportType, reportGenerationData);
    if (!generationResult.success) {
      return NextResponse.json({
        error: 'Ошибка генерации отчета',
        details: generationResult.error,
        templateErrors: generationResult.templateErrors || []
      }, { status: 422 });
    }

    // Используем транзакцию для обеспечения целостности данных
    const result = await prisma.$transaction(async (tx) => {
      // Получаем или создаем пользователя в базе данных
      const internalUserId = ctx.userIdInternal;

      // Проверяем, что пользователь действительно существует
      const user = await tx.user.findUnique({
        where: { id: internalUserId }
      });

      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      // Создаем запись в базе данных
      const reportData = {
        userId: internalUserId,
        reportType: body.reportType as ReportType,
        format: 'PDF',
        fileName: generationResult.fileName || `Report_${Date.now()}.pdf`,
        filePath: generationResult.filePath || '',
        fileSize: generationResult.fileSize || 0,
        emissionData: body.emissionData || {},
        methodology: reportType === 'CBAM' ? 'CBAM-2025' : '296-FZ-2025',
        downloadCount: 0,
        version: 1,
        isLocked: false
      };

      // Если есть данные по выбросам, вычисляем totalEmissions (в тоннах CO2)
      let totalEmissions = 0;
      try {
        const ed = reportGenerationData as any;
        totalEmissions = Number(
          ed?.totalEmissions || ed?.emissionData?.totalEmissions || ed?.emissions_total || 0
        );
      } catch {}

      // Уважаем формат, переданный клиентом; по умолчанию — PDF
      try {
        const preferred = String(body.format || 'PDF').toUpperCase();
        const allowed = ['PDF','XLSX','CSV','XML'];
        if (allowed.includes(preferred)) {
          (reportData as any).format = preferred;
          // На этапе MVP оставляем расширение .pdf, даже если выбран не-PDF формат
        }
      } catch {}

      const createdReport = await tx.report.create({
        data: reportData,
      });

      // Проверяем превышение лимита и при необходимости инициируем доплату
      try {
        const org = await tx.organization.findFirst({ where: { id: ctx.organizationId } });
        const subscription = await tx.organization_subscriptions.findUnique({ where: { organizationId: org!.id } });
        const planKey = String(subscription?.plan_type || 'STANDARD').toLowerCase();
        const { loadMonetizationConfig } = await import('@/lib/monetization-config');
        const cfg: any = loadMonetizationConfig();
        const planCfg = cfg[planKey] || cfg.standard;
        const limit = Number(planCfg?.maxEmissions || 0);

        if (limit > 0 && totalEmissions > limit) {
          const rate = Number(planCfg?.ratePerTon || 0);
          const excess = Math.max(0, totalEmissions - limit);
          // Блокируем экспорт
          await tx.report.update({ where: { id: createdReport.id }, data: { isLocked: true as any } as any });
          // Создаем счет на доплату асинхронно (без ожидания)
          fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/payments/overage-invoice`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reportId: createdReport.id, excessEmissions: excess, ratePerTon: rate })
          }).catch(() => void 0);
        }
      } catch (e) {
        console.warn('Overage check failed (continue):', (e as any)?.message);
      }

      return { report: createdReport, user, generationResult };
    });

    console.log(`✅ Отчет создан: ${result.report.id}, тип: ${result.report.reportType}, пользователь: ${result.user.id}`);
    
    if (result.generationResult?.unreplacedTokens && result.generationResult.unreplacedTokens.length > 0) {
      console.warn('⚠️ Незамененные токены:', result.generationResult.unreplacedTokens);
    }

    return NextResponse.json({
      ...result.report,
      generationInfo: {
        success: result.generationResult?.success || false,
        unreplacedTokens: result.generationResult?.unreplacedTokens || []
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Ошибка при создании отчета:', error);
    
    // Детальная обработка ошибок
    if (error instanceof Error) {
      // Ошибки аутентификации пользователя
      if (error.message.includes('Не удалось получить данные пользователя') || 
          error.message === 'USER_NOT_FOUND') {
        return NextResponse.json(
          { error: 'Ошибка аутентификации пользователя' },
          { status: 401 }
        );
      }

      // Ошибки базы данных
      if (error.message.includes('Unique constraint')) {
        return NextResponse.json(
          { error: 'Отчет с такими параметрами уже существует' },
          { status: 409 }
        );
      }

      // Ошибки валидации Prisma
      if (error.message.includes('Invalid') || error.message.includes('Required')) {
        return NextResponse.json(
          { error: 'Некорректные данные для создания отчета' },
          { status: 400 }
        );
      }

      // Ошибки транзакций
      if (error.message.includes('Transaction')) {
        return NextResponse.json(
          { error: 'Ошибка транзакции базы данных' },
          { status: 500 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера при создании отчета' },
      { status: 500 }
    );
  }
} 