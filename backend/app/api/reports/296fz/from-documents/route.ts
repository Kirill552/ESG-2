/**
 * Генерация отчета 296‑ФЗ из набора документов (автоматически по ocrData)
 * POST /api/reports/296fz/from-documents
 */

import { NextRequest, NextResponse } from 'next/server';
// Используем общий экземпляр Prisma с middleware шифрования,
// чтобы поведение совпадало с остальным приложением и тестами
import prisma from '@/lib/prisma';
import { requireOrgRole } from '@/lib/rbac';
import { generate296FZFromDocuments } from '@/lib/report-from-documents';
import { loadMonetizationConfig } from '@/lib/monetization-config';
import { generateMultiFormatReport, ExportFormat } from '@/lib/multi-format-generator';


export const maxDuration = 600;

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireOrgRole(['OWNER', 'ECOLOGIST']);
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const {
      documentIds,
      signer,
      reportYear,
      options,
      formats
    }: {
      documentIds: string[];
      signer?: { name: string; position?: string };
      reportYear?: string;
      options?: { outputDir?: string; templateDir?: string; includeMetadata?: boolean };
      formats?: ExportFormat[];
    } = body || {};

    // Backward compatibility with single format field
    const requestedFormats = formats || ['pdf'];

    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json({ error: 'Не переданы documentIds' }, { status: 400 });
    }

    // Получаем профиль организации для подстановки реквизитов
    const orgProfile = await prisma.organizationProfile.findUnique({
      where: { organizationId: ctx.organizationId }
    });

    if (!orgProfile) {
      return NextResponse.json({ error: 'Профиль организации не найден' }, { status: 404 });
    }

    // Валидация критичных реквизитов профиля (ИНН обязателен)
    const missingFields: string[] = [];
    if (!orgProfile.inn) missingFields.push('inn');
    if (!orgProfile.shortName && !orgProfile.fullName) missingFields.push('name');
    if (!orgProfile.legalAddress) missingFields.push('legalAddress');

    if (missingFields.includes('inn')) {
      return NextResponse.json(
        {
          error: 'Профиль организации не заполнен',
          code: 'ORG_PROFILE_INCOMPLETE',
          missingFields,
          message:
            'В настройках организации отсутствует ИНН (и/или другие поля). Заполните реквизиты в Настройки → Организация, затем повторите попытку.'
        },
        { status: 400 }
      );
    }

    // Проверка лимита триального плана (аналогично /api/reports)
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

    // Подготовка данных организации
    const orgData = {
      name: orgProfile.shortName || orgProfile.fullName || 'Не указано',
      inn: orgProfile.inn,
      address: orgProfile.legalAddress || 'Не указано',
      phone: orgProfile.phone || undefined,
      email: orgProfile.emailForBilling || undefined,
      okpo: orgProfile.ogrn || undefined,
      oktmo: undefined as string | undefined
    };

    const signerData = {
      name: signer?.name || (orgProfile.shortName || 'Подписант'),
      position: signer?.position || 'Ответственный за отчет'
    };

    // Генерация отчета из документов (получаем данные)
    const dataResult = await generate296FZFromDocuments({
      documentIds,
      organization: orgData,
      signer: signerData,
      reportYear,
      options
    });

    if (!dataResult.success) {
      return NextResponse.json({ error: dataResult.error || 'Ошибка генерации отчета' }, { status: 400 });
    }

    // Теперь создаем многоформатный отчет используя полные данные из первого этапа генерации
    const fullData = (dataResult as any).fullReportData || {};
    const multiFormatResult = await generateMultiFormatReport('296-FZ', {
      ...fullData, // Используем полные данные включая выбросы
      // Переопределяем только системные поля если нужно
      generation_date: new Date().toLocaleDateString('ru-RU'),
      generation_time: new Date().toLocaleTimeString('ru-RU'),
      document_id: `296FZ_${Date.now()}`,
    }, {
      formats: requestedFormats,
      outputDir: options?.outputDir || 'public/reports',
      templateDir: options?.templateDir || 'templates',
      includeMetadata: options?.includeMetadata !== false
    });

    if (!multiFormatResult.success || multiFormatResult.files.length === 0) {
      return NextResponse.json({ error: 'Ошибка создания отчетов в запрошенных форматах' }, { status: 400 });
    }

  // Создаем запись отчета и проверяем превышение лимитов плана
  const created = await prisma.$transaction(async (tx) => {
    const orgNameForFile = (orgProfile.shortName || orgProfile.fullName || 'Org').replace(/[^\wа-яА-Я0-9]+/g, '_').slice(0, 40);
    const yearForFile = String(reportYear || new Date().getFullYear());
    
    // For multi-format reports, use the first successful file for database record
    const primaryFile = multiFormatResult.files.find(f => f.success) || multiFormatResult.files[0];
    const serverFileName = primaryFile?.fileName || `296FZ_${orgNameForFile}_${yearForFile}.pdf`;

    // totalEmissionsRaw (тонн CO2e) из результата генерации
    const totalEmissionsRaw = Number(dataResult.totalEmissionsRaw || 0);

    const report = await tx.report.create({
        data: {
          userId: ctx.userIdInternal,
          reportType: 'REPORT_296FZ',
          format: (primaryFile?.format?.toUpperCase() || 'PDF') as any,
          fileName: serverFileName,
          filePath: primaryFile?.filePath || '',
          fileSize: primaryFile?.fileSize || 0,
          emissionData: { 
            totalEmissions: totalEmissionsRaw,
            multiFormat: {
              files: multiFormatResult.files.map(f => ({
                format: f.format,
                fileName: f.fileName,
                filePath: f.filePath,
                fileSize: f.fileSize,
                success: f.success
              }))
            }
          },
          methodology: '296-FZ-2025'
        }
      });

  // Используем реальные «сырые» выбросы для проверки превышения
  let totalEmissions = totalEmissionsRaw;

      try {
        const subscription = await tx.organization_subscriptions.findUnique({ where: { organizationId: ctx.organizationId } });
        const planKey = String(subscription?.plan_type || 'STANDARD').toLowerCase();
        const { loadMonetizationConfig } = await import('@/lib/monetization-config');
        const cfg: any = loadMonetizationConfig();
        const planCfg = cfg[planKey] || cfg.standard;
        const limit = Number(planCfg?.maxEmissions || 0);
        if (limit > 0 && totalEmissions > limit) {
          const rate = Number(planCfg?.ratePerTon || 0);
          const excess = Math.max(0, totalEmissions - limit);
          await tx.report.update({ where: { id: report.id }, data: { isLocked: true as any } as any });
          fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/payments/overage-invoice`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reportId: report.id, excessEmissions: excess, ratePerTon: rate })
          }).catch(() => void 0);
        }
      } catch (e) {
        console.warn('Overage check failed (continue):', (e as any)?.message);
      }

      return report;
    });

    return NextResponse.json({
      success: true,
      report: {
        id: created.id,
        formats: multiFormatResult.files.map(f => ({
          format: f.format,
          fileName: f.fileName,
          filePath: f.filePath,
          fileSize: f.fileSize,
          success: f.success,
          error: f.error
        })),
        totalSize: multiFormatResult.totalSize,
        // Backward compatibility
        fileName: (multiFormatResult.files.find(f => f.success) || multiFormatResult.files[0])?.fileName,
        filePath: (multiFormatResult.files.find(f => f.success) || multiFormatResult.files[0])?.filePath,
        fileSize: (multiFormatResult.files.find(f => f.success) || multiFormatResult.files[0])?.fileSize
      },
      unreplacedTokens: dataResult.unreplacedTokens || []
    }, { status: 201 });

  } catch (error) {
    console.error('Ошибка генерации 296‑ФЗ из документов:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
