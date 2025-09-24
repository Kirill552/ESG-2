/**
 * Создание отчета «Углеродный след» (CARBON_FOOTPRINT)
 * POST /api/reports/carbon-footprint
 * ОБНОВЛЕНО: интеграция с новой логикой расчета выбросов из документов
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireOrgRole } from '@/lib/rbac'
import { generateCarbonFootprintFromDocuments } from '@/lib/carbon-footprint-adapter'
import { generateMultiFormatReport } from '@/lib/multi-format-generator'

type CarbonFootprintBody = {
  reportingPeriod?: string // Год отчета (например, "2025")
  
  // НОВОЕ: Автоматический расчет из документов
  documentIds?: string[] // ID документов для автоматического расчета
  
  // Дополнительные данные для расчета интенсивности
  additionalData?: {
    production_volume?: number
    revenue_rub?: number  
    employee_count?: number
  }
  
  // Ручные значения (если не используется автоматический расчет)
  scope1?: number // т CO2e
  scope2?: number // т CO2e
  scope3?: number // т CO2e (опционально)
  total?: number // если передан — используется валидацией, иначе суммируем scope1..3
  intensity?: number // т CO2e/т продукции (опционально)
  methodology?: string // методика расчета
  dataQuality?: string // уровень качества данных
  emissionSources?: Array<{
    name: string
    category?: 'Scope1' | 'Scope2' | 'Scope3'
    activity?: number
    unit?: string
    emissionFactor?: number
    controlEfficiency?: number
    co2e?: number
  }>
  notes?: string
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireOrgRole(['OWNER', 'ECOLOGIST'])
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const raw = await request.json().catch(() => ({} as any))
  const body: CarbonFootprintBody = raw
  const selectedFormats = raw?.formats ? raw.formats : [String(raw?.format || 'PDF').toLowerCase()]

    // Профиль организации — реквизиты берем отсюда
    const orgProfile = await prisma.organizationProfile.findUnique({
      where: { organizationId: ctx.organizationId }
    })
    if (!orgProfile) {
      return NextResponse.json({ error: 'Профиль организации не найден' }, { status: 404 })
    }
    if (!orgProfile.inn) {
      return NextResponse.json(
        {
          error: 'Профиль организации не заполнен',
          code: 'ORG_PROFILE_INCOMPLETE',
          missingFields: ['inn'],
          message: 'В настройках организации отсутствует ИНН. Заполните реквизиты и повторите.'
        },
        { status: 400 }
      )
    }

    const year = String(body.reportingPeriod || new Date().getFullYear())
    
    let emissionData: any;
    
    // НОВАЯ ЛОГИКА: Если указаны documentIds, используем автоматический расчет из документов
    if (body.documentIds && body.documentIds.length > 0) {
      const result = await generateCarbonFootprintFromDocuments({
        documentIds: body.documentIds,
        organization: {
          name: orgProfile.shortName || orgProfile.fullName || 'Не указано',
          inn: orgProfile.inn,
          address: orgProfile.legalAddress || 'Не указано'
        },
        signer: {
          name: 'Не указано', // TODO: получить из профиля или запроса
          position: 'Не указано'
        },
        reportYear: year,
        additionalData: body.additionalData
      });
      
      // Преобразуем для шаблона
      emissionData = {
        companyName: orgProfile.shortName || orgProfile.fullName || 'Не указано',
        fullCompanyName: orgProfile.fullName || orgProfile.shortName || undefined,
        inn: orgProfile.inn,
        kpp: orgProfile.kpp || undefined,
        ogrn: orgProfile.ogrn || undefined,
        address: orgProfile.legalAddress || undefined,
        reportingPeriod: year,
        // АВТОМАТИЧЕСКИ РАССЧИТАННЫЕ показатели 2025
        scope1: result.rawEmissions.scope1_kg / 1000, // кг -> тонны
        scope2: result.rawEmissions.scope2_kg / 1000,
        scope3: result.rawEmissions.scope3_kg / 1000,
        totalEmissions: result.rawEmissions.total_kg / 1000,
        intensity: body.additionalData ? result.templateData.intensity : undefined,
        methodology: result.templateData.methodology,
        dataQuality: result.templateData.data_quality,
        emissionSources: [], // TODO: извлечь из result.extractionSummary
        notes: `Автоматически рассчитано из ${body.documentIds.length} документов. ${JSON.stringify(result.extractionSummary)}`,
        // Дополнительные данные для аудита
        calculationMethod: 'automatic_from_documents',
        extractionSummary: result.extractionSummary
      };
    } else {
      // СТАРАЯ ЛОГИКА: Ручной ввод значений
      const scope1 = Number(body.scope1 || 0)
      const scope2 = Number(body.scope2 || 0)
      const scope3 = Number(body.scope3 || 0)
      const computedTotal = Math.max(0, scope1 + scope2 + scope3)
      const total = Number(body.total ?? computedTotal)

      emissionData = {
        companyName: orgProfile.shortName || orgProfile.fullName || 'Не указано',
        fullCompanyName: orgProfile.fullName || orgProfile.shortName || undefined,
        inn: orgProfile.inn,
        kpp: orgProfile.kpp || undefined,
        ogrn: orgProfile.ogrn || undefined,
        address: orgProfile.legalAddress || undefined,
        reportingPeriod: year,
        // Ручные показатели 2025
        scope1,
        scope2,
        scope3,
        totalEmissions: total,
        intensity: body.intensity || undefined,
        methodology: body.methodology || 'Russian CF Standard 2025',
        dataQuality: body.dataQuality || 'Not assessed',
        emissionSources: body.emissionSources || [],
        notes: body.notes || undefined,
        calculationMethod: 'manual_input'
      };
    }

    // Генерируем многоформатный отчет
    const multiFormatResult = await generateMultiFormatReport('CF', {
      org_name: emissionData.companyName,
      org_inn: emissionData.inn || '',
      org_address: emissionData.address || '',
      signer_name: 'Не указано',
      signer_position: 'Ответственный за отчет',
      sign_date: new Date().toLocaleDateString('ru-RU'),
      generation_date: new Date().toLocaleDateString('ru-RU'),
      generation_time: new Date().toLocaleTimeString('ru-RU'),
      document_id: `CF_${Date.now()}`,
      report_year: year,
      scope1: emissionData.scope1?.toString() || '0',
      scope2: emissionData.scope2?.toString() || '0', 
      scope3: emissionData.scope3?.toString() || '0',
      total_co2e: emissionData.totalEmissions?.toString() || '0',
      intensity: emissionData.intensity?.toString() || '',
      data_quality: emissionData.dataQuality || '',
      methodology: emissionData.methodology || 'Russian CF Standard 2025'
    }, {
      formats: selectedFormats,
      outputDir: 'public/reports',
      templateDir: 'templates',
      includeMetadata: true
    });

    if (!multiFormatResult.success) {
      return NextResponse.json({ error: 'Ошибка создания отчета в выбранных форматах' }, { status: 400 });
    }

    // Используем первый успешный файл для записи в базу
    const primaryFile = multiFormatResult.files.find(f => f.success) || multiFormatResult.files[0];
    const orgNameForFile = (orgProfile.shortName || orgProfile.fullName || 'Org')
      .replace(/[^\wа-яА-Я0-9]+/g, '_')
      .slice(0, 40)
    const serverFileName = primaryFile?.fileName || `CF_${orgNameForFile}_${year}.pdf`

  const created = await prisma.report.create({
      data: {
        userId: ctx.userIdInternal,
        reportType: 'CARBON_FOOTPRINT',
    format: (primaryFile?.format?.toUpperCase() || 'PDF') as any,
        fileName: serverFileName,
        filePath: primaryFile?.filePath || '',
        fileSize: primaryFile?.fileSize || 0,
        emissionData: {
          ...emissionData,
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
        methodology: emissionData.methodology
      }
    })

    return NextResponse.json(
      {
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
          // Обратная совместимость
          fileName: primaryFile?.fileName,
          filePath: primaryFile?.filePath,
          fileSize: primaryFile?.fileSize
        }
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Ошибка создания Carbon Footprint отчета:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
