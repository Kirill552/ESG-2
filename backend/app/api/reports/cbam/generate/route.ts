/**
 * API для генерации CBAM отчетов с интегрированным pricing
 * POST /api/reports/cbam/generate - генерация отчета с проверкой подписки
 * POST /api/reports/cbam/preview - предварительный расчет стоимости
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireOrgRole } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import {
  generateCBAMReportWithPricing,
  getCBAMReportPricing,
  type CBAMReportGenerationData,
  type CBAMReportGenerationOptions
} from '@/lib/enhanced-report-generator';
import { generateCBAMFromDocuments } from '@/lib/cbam-adapter';

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireOrgRole(['OWNER', 'ACCOUNTANT', 'ECOLOGIST']);
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'generate';
    
    const body = await request.json();
    let reportData: CBAMReportGenerationData;
    const options: CBAMReportGenerationOptions = body.options || {};
    
    // НОВАЯ ЛОГИКА: Если указаны documentIds, используем автоматический расчет из документов
    if (body.documentIds && Array.isArray(body.documentIds) && body.documentIds.length > 0) {
      const orgProfile = await prisma.organizationProfile.findUnique({
        where: { organizationId: ctx.organizationId }
      });
      
      if (!orgProfile) {
        return NextResponse.json({ error: 'Профиль организации не найден' }, { status: 404 });
      }
      
      const result = await generateCBAMFromDocuments({
        documentIds: body.documentIds,
        organization: {
          name: orgProfile.shortName || orgProfile.fullName || 'Не указано',
          address: orgProfile.legalAddress || 'Не указано',
          email: orgProfile.emailForBilling || 'Не указано',
          country: 'RU',
          eori: body.eori,
          cbam_id: body.cbam_id
        },
        signer: {
          name: body.signer_name || 'Не указано',
          position: body.signer_position || 'Не указано'
        },
        reportYear: body.reportYear
      });
      
      // Преобразуем в формат CBAMReportGenerationData
      reportData = {
        organizationId: ctx.organizationId,
        ...result.templateData,
        // Дополнительные поля для совместимости
        totalEmissions: result.totalEmissions,
        calculationMethod: 'automatic_from_documents',
        documentCount: body.documentIds.length,
        extractionSummary: result.extractionSummary
      } as CBAMReportGenerationData;
    } else {
      // СТАРАЯ ЛОГИКА: Ручные данные
      reportData = body.reportData || body;
    }

    // Валидация обязательных полей
    if (!reportData.organizationId) {
      return NextResponse.json(
        { error: 'Validation Error', message: 'Не указан organizationId' },
        { status: 400 }
      );
    }

    if (!reportData.org_name) {
      return NextResponse.json(
        { error: 'Validation Error', message: 'Не указано название организации' },
        { status: 400 }
      );
    }

    // Обработка предварительного расчета
    if (action === 'preview') {
      const pricingResult = await getCBAMReportPricing(reportData);
      
      if (!pricingResult.success) {
        return NextResponse.json(
          { 
            error: 'Pricing Error',
            message: pricingResult.reason || 'Ошибка при расчете стоимости'
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        action: 'preview',
        data: {
          pricing: pricingResult.pricing,
          canGenerate: pricingResult.canGenerate,
          reason: pricingResult.reason,
          organizationId: reportData.organizationId
        },
        meta: {
          timestamp: new Date().toISOString(),
          userId: ctx.userIdInternal,
          reportType: 'CBAM'
        }
      });
    }

    // Обработка генерации отчета
    if (action === 'generate') {
      // Генерируем отчет и считаем стоимость, но списания применим после сохранения отчета в БД
      const reportResult = await generateCBAMReportWithPricing(reportData, {
        ...options,
        applyCharges: false
      });

      if (!reportResult.success) {
        const statusCode = reportResult.blocked ? 402 : 400; // 402 Payment Required для блокировки
        
        return NextResponse.json(
          { 
            error: reportResult.blocked ? 'Payment Required' : 'Generation Error',
            message: reportResult.error || 'Ошибка при генерации отчета',
            blocked: reportResult.blocked,
            blockReason: reportResult.blockReason,
            pricing: reportResult.pricingInfo
          },
          { status: statusCode }
        );
      }

      // Сохраняем отчет в БД с серверным именем файла и emissionData
      const orgProfile = await prisma.organizationProfile.findUnique({
        where: { organizationId: ctx.organizationId }
      });

      const orgNameForFile = (orgProfile?.shortName || orgProfile?.fullName || reportData.org_name || 'Org')
        .replace(/[^\wа-яА-Я0-9]+/g, '_')
        .slice(0, 40);
      const period = reportData.report_year_q || new Date().toISOString().slice(0, 7); // YYYY-MM
      const serverFileName = reportResult.fileName || `CBAM_${orgNameForFile}_${period}.pdf`;

      const totalEmissions = Number(reportResult.pricingInfo?.calculation?.totalEmissions || 0);
      const emissionData: any = {
        totalEmissions,
        cbam: reportResult.pricingInfo?.calculation || null
      };

    const desiredFormat = String((options as any)?.format || (reportData as any)?.format || 'PDF').toUpperCase();
    const allowedFormats = ['PDF','XML','CSV'];
    const finalFormat = allowedFormats.includes(desiredFormat) ? desiredFormat : 'PDF';

    const created = await prisma.report.create({
        data: {
          userId: ctx.userIdInternal,
          reportType: 'CBAM_XML',
      format: finalFormat as any,
      // На этапе MVP сохраняем .pdf, даже если выбран другой формат
      fileName: serverFileName,
          filePath: reportResult.filePath || '',
          fileSize: reportResult.fileSize || 0,
          emissionData,
          methodology: 'CBAM-TRANSITIONAL-2025'
        }
      });

      // Применяем начисления (если есть) теперь, когда у нас есть ID отчета
      try {
        if (reportResult.pricingInfo?.calculation && reportResult.pricingInfo.totalCost > 0) {
          const { recordCBAMCharges } = await import('@/lib/cbam-pricing');
          await recordCBAMCharges(reportResult.pricingInfo.calculation, created.id);
        }
      } catch (chargeErr) {
        console.warn('CBAM charges record failed (continue):', (chargeErr as any)?.message);
      }

      return NextResponse.json({
        success: true,
        action: 'generate',
        data: {
          report: {
            id: created.id,
            filePath: created.filePath,
            fileName: created.fileName,
            fileSize: created.fileSize
          },
          pricing: reportResult.pricingInfo,
          unreplacedTokens: reportResult.unreplacedTokens
        },
        meta: {
          timestamp: new Date().toISOString(),
          userId: ctx.userIdInternal,
          reportType: 'CBAM',
          organizationId: reportData.organizationId
        }
      });
    }

    // Неизвестное действие
    return NextResponse.json(
      { 
        error: 'Invalid Action',
        message: `Неизвестное действие: ${action}. Поддерживаются: generate, preview`
      },
      { status: 400 }
    );

  } catch (error) {
    console.error('CBAM report generation API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal Server Error',
        message: 'Ошибка при обработке запроса на генерацию CBAM отчета'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireOrgRole(['OWNER', 'ACCOUNTANT', 'ECOLOGIST', 'VIEWER']);
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Возвращаем информацию о CBAM генерации
    return NextResponse.json({
      success: true,
      data: {
        supportedActions: ['generate', 'preview'],
        supportedFormats: ['CBAM_XML', 'CBAM_CSV'],
        pricingInfo: {
          ratePerTon: 255,
          currency: 'RUB',
          subscriptionBenefit: 'Бесплатно для владельцев CBAM подписки'
        },
        requiredFields: [
          'organizationId',
          'org_name',
          'org_address',
          'signer_name',
          'sign_date',
          'lineItems[] или product_*_* поля'
        ]
      },
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    });

  } catch (error) {
    console.error('CBAM report info API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal Server Error',
        message: 'Ошибка при получении информации о CBAM отчетах'
      },
      { status: 500 }
    );
  }
}
