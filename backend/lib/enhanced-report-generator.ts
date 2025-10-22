/**
 * Интегрированный сервис генерации отчетов 296-ФЗ
 * Объединяет template-engine, pdf-generator и emission-calculator
 * На основе проверенной логики из предыдущего MVP
 */

import fs from 'fs/promises';
import path from 'path';
import { processTemplate, TemplateData, ReportType } from './template-engine';
import { generateReportPDF, PDFGenerationResult } from './pdf-generator';
import { calculateEmissions, EmissionData, EmissionResult, computeTotalCO2eRaw } from './emission-calculator';

export interface ReportGenerationData {
  // Общие поля
  org_name: string;
  org_address: string;
  signer_name: string;
  signer_position?: string;
  sign_date: string;
  generation_date: string;
  generation_time: string;
  document_id: string;

  // Поля для 296-FZ
  org_inn?: string;
  org_okpo?: string;
  org_oktmo?: string;
  org_phone?: string;
  org_email?: string;
  report_year?: string;
  organizationLegalForm?: string; // Организационно-правовая форма (ООО, АО, и т.д.)

  // Поля для CBAM
  eori?: string;
  cbam_id?: string;
  org_country?: string;
  report_year_q?: string;

  // Поля для CF (углеродный след)
  scope1?: string;
  scope2?: string;
  scope3?: string;
  total_co2e?: string;
  intensity?: string;
  data_quality?: string;

  // Данные о товарах/выбросах (динамические)
  [key: string]: string | number | boolean | undefined;
}

export interface ReportGenerationOptions {
  outputDir?: string;
  templateDir?: string;
  includeMetadata?: boolean;
  writeToDisk?: boolean;
}

export interface ReportGenerationResult {
  success: boolean;
  html?: string;
  pdf?: Buffer;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  templateErrors?: string[];
  unreplacedTokens?: string[];
  error?: string;
  totalEmissionsRaw?: number;
  fullReportData?: ReportGenerationData;
}

/**
 * Загрузка HTML шаблона
 */
async function loadTemplate(reportType: ReportType, templateDir: string = 'templates'): Promise<string> {
  const templateFileName = reportType === '296-FZ'
    ? 'ru-296fz-report-2025.html'
    : reportType === 'CBAM'
      ? 'eu-cbam-quarterly-2025.html'
      : 'ru-carbon-footprint-2025.html';

  const templatePath = path.join(templateDir, templateFileName);

  try {
    return await fs.readFile(templatePath, 'utf-8');
  } catch (error) {
    // Fallback: минимальный встроенный шаблон
    if (reportType === '296-FZ') {
      return `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><title>Отчет 296‑ФЗ</title>
        <style>body{font-family:DejaVu Sans, Arial, sans-serif;padding:24px;font-size:12pt}</style>
      </head><body>
        <h1>Отчет о выбросах (296‑ФЗ)</h1>
        <p><strong>Организация:</strong> [[org_name]] (ИНН [[org_inn]])</p>
        <p><strong>Адрес:</strong> [[org_address]]</p>
        <p><strong>Отчетный год:</strong> [[report_year]]</p>
        <hr/>
        <h2>Итоги</h2>
        <p><strong>Совокупные выбросы, т CO₂‑экв:</strong> [[total_co2e]]</p>
        <h2>Подписант</h2>
        <p>[[signer_name]], [[signer_position]]</p>
        <p>Тел.: [[org_phone]]</p>
        <p>Дата: [[sign_date]]</p>
      </body></html>`;
    }
    return '<html><body><h1>Ошибка загрузки шаблона</h1></body></html>';
  }
}

/**
 * Подготовка данных с метаданными
 */
function prepareTemplateData(
  data: ReportGenerationData,
  reportType: ReportType,
  includeMetadata: boolean = true
): TemplateData {
  const now = new Date();

  const baseData: TemplateData = { ...data };

  if (includeMetadata) {
    baseData.generation_date = data.generation_date || now.toLocaleDateString('ru-RU');
    baseData.generation_time = data.generation_time || now.toLocaleTimeString('ru-RU');
    baseData.document_id = data.document_id || `${reportType}_${Date.now()}`;
    baseData.sign_date = data.sign_date || now.toLocaleDateString('ru-RU');
  }

  // Маппинг полей для шаблона 296-FZ
  if (reportType === '296-FZ') {
    // Основные поля организации
    baseData.inn = data.org_inn || baseData.inn || 'Не указано';
    baseData.address = data.org_address || baseData.address || 'Не указано';
    baseData.org_inn = baseData.inn;
    baseData.org_address = baseData.address;
    baseData.phone = data.org_phone || baseData.phone || 'Не указано';
    baseData.email = data.org_email || baseData.email || 'Не указано';
    baseData.okpo = data.org_okpo || baseData.okpo || 'Не указано';
    baseData.oktmo = data.org_oktmo || baseData.oktmo || 'Не указано';

    // Поля подписанта для 296-FZ (executor)
    baseData.executor_fio = data.signer_name || baseData.executor_fio || 'Не указано';
    baseData.executor_phone = data.org_phone || baseData.executor_phone || 'Не указано';

    // Дополнительные поля для 296-FZ
    baseData.legal_form = data.organizationLegalForm || baseData.legal_form || 'Не указана';
    baseData.ogrn = baseData.ogrn || data.org_okpo || 'Не указано';
    baseData.okved = baseData.okved || '38.11';
    baseData.submission_basis = baseData.submission_basis || 'п. 4 ст. 23 296-ФЗ';

    // Данные о выбросах (заполняем базовыми значениями если не указаны)
    baseData.co2_mass = baseData.co2_mass || '0';
    baseData.co2e_co2 = baseData.co2e_co2 || '0';
    baseData.co2_percent = baseData.co2_percent || '0';
    baseData.ch4_mass = baseData.ch4_mass || '0';
    baseData.co2e_ch4 = baseData.co2e_ch4 || '0';
    baseData.ch4_percent = baseData.ch4_percent || '0';
    baseData.n2o_mass = baseData.n2o_mass || '0';
    baseData.co2e_n2o = baseData.co2e_n2o || '0';
    baseData.n2o_percent = baseData.n2o_percent || '0';
    baseData.hfc_mass = baseData.hfc_mass || '0';
    baseData.hfc_gwp = baseData.hfc_gwp || '0';
    baseData.co2e_hfc = baseData.co2e_hfc || '0';
    baseData.hfc_percent = baseData.hfc_percent || '0';
    baseData.pfc_mass = baseData.pfc_mass || '0';
    baseData.pfc_gwp = baseData.pfc_gwp || '0';
    baseData.co2e_pfc = baseData.co2e_pfc || '0';
    baseData.pfc_percent = baseData.pfc_percent || '0';
    baseData.sf6_mass = baseData.sf6_mass || '0';
    baseData.co2e_sf6 = baseData.co2e_sf6 || '0';
    baseData.sf6_percent = baseData.sf6_percent || '0';
    baseData.total_co2e = baseData.total_co2e || '0';

    // Процессы
    baseData.proc_1_code = baseData.proc_1_code || 'Не указано';
    baseData.proc_1_desc = baseData.proc_1_desc || 'Не указано';
    baseData.proc_1_nvos = baseData.proc_1_nvos || 'Не указано';
    baseData.proc_1_capacity = baseData.proc_1_capacity || '0';
    baseData.proc_1_unit = baseData.proc_1_unit || 'шт.';

    baseData.proc_2_code = baseData.proc_2_code || '';
    baseData.proc_2_desc = baseData.proc_2_desc || '';
    baseData.proc_2_nvos = baseData.proc_2_nvos || '';
    baseData.proc_2_capacity = baseData.proc_2_capacity || '';
    baseData.proc_2_unit = baseData.proc_2_unit || '';
  }

  return baseData;
}

/**
 * Генерирует PDF из HTML
 */
async function generatePDFFromHTML(html: string): Promise<Buffer> {
  const puppeteer = require('puppeteer');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm'
      },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div style="font-size: 10px; margin: 0 auto;">296-ФЗ Отчет о выбросах парниковых газов</div>',
      footerTemplate: '<div style="font-size: 10px; margin: 0 auto;">Страница <span class="pageNumber"></span> из <span class="totalPages"></span></div>'
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

/**
 * Основная функция генерации отчета
 */
export async function generateReport(
  reportType: ReportType,
  data: ReportGenerationData,
  options: ReportGenerationOptions = {}
): Promise<ReportGenerationResult> {
  try {
    const {
      outputDir = 'public/reports',
      templateDir = 'templates',
      includeMetadata = true,
      writeToDisk = true
    } = options;

    console.log(`📋 Генерация отчета ${reportType} для ${data.org_name}`);

    // 1. Загружаем шаблон
    const template = await loadTemplate(reportType, templateDir);
    console.log(`✅ Шаблон ${reportType} загружен`);

    // 2. Подготавливаем данные
    const templateData = prepareTemplateData(data, reportType, includeMetadata);

    // 3. Обрабатываем шаблон
    const templateResult = processTemplate(template, templateData, reportType);

    if (templateResult.errors.length > 0) {
      return {
        success: false,
        templateErrors: templateResult.errors,
        error: 'Ошибки валидации данных шаблона'
      };
    }

    if (templateResult.unreplacedTokens.length > 0) {
      console.warn('⚠️ Незамененные токены:', templateResult.unreplacedTokens);
    }

    console.log('✅ Шаблон обработан, токены заменены');

    // 4. Генерируем PDF
    let filePath: string | undefined;
    let pdfBuffer: Buffer | undefined;

    if (writeToDisk) {
      const reportPeriod = reportType === '296-FZ'
        ? (data.report_year || '2025')
        : reportType === 'CBAM'
          ? (data.report_year_q || '2025-2')
          : (data.report_year || '2025');

      const pdfResult = await generateReportPDF(
        templateResult.processedHtml,
        reportType,
        data.org_name,
        reportPeriod,
        outputDir
      );

      if (!pdfResult.success) {
        return {
          success: false,
          error: `Ошибка генерации PDF: ${pdfResult.error}`
        };
      }

      filePath = pdfResult.filePath;
    }

    // Генерируем PDF в буфер для скачивания
    pdfBuffer = await generatePDFFromHTML(templateResult.processedHtml);

    console.log(`🎉 Отчет ${reportType} успешно создан`);

    return {
      success: true,
      html: templateResult.processedHtml,
      pdf: pdfBuffer,
      filePath,
      fileName: filePath ? path.basename(filePath) : undefined,
      fileSize: pdfBuffer?.length,
      unreplacedTokens: templateResult.unreplacedTokens,
      fullReportData: data
    };

  } catch (error) {
    console.error(`❌ Ошибка генерации отчета ${reportType}:`, error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    };
  }
}

/**
 * Генерация отчета 296-FZ с расчетом выбросов
 */
export async function generate296FZReport(
  data: ReportGenerationData,
  options?: ReportGenerationOptions
): Promise<ReportGenerationResult> {
  // Если есть данные о выбросах - рассчитываем
  if (data.co2_mass || data.ch4_mass || data.n2o_mass) {
    const emissionData: EmissionData = {
      co2_mass: parseFloat(String(data.co2_mass || 0)),
      ch4_mass: parseFloat(String(data.ch4_mass || 0)),
      n2o_mass: parseFloat(String(data.n2o_mass || 0)),
      hfc_mass: parseFloat(String(data.hfc_mass || 0)),
      pfc_mass: parseFloat(String(data.pfc_mass || 0)),
      sf6_mass: parseFloat(String(data.sf6_mass || 0))
    };

    const calculatedEmissions = calculateEmissions(emissionData);
    const rawEmissions = computeTotalCO2eRaw(emissionData);

    // Добавляем рассчитанные значения к данным
    const enhancedData = {
      ...data,
      ...calculatedEmissions,
      totalEmissionsRaw: rawEmissions.total
    };

    const result = await generateReport('296-FZ', enhancedData, options);

    if (result.success) {
      result.totalEmissionsRaw = rawEmissions.total;
    }

    return result;
  }

  return generateReport('296-FZ', data, options);
}

/**
 * Полная генерация отчета 296-ФЗ с данными о выбросах и PDF
 */
export async function generate296FZFullReport(
  reportData: {
    organizationId: string;
    organizationName: string;
    documentId: string;
    reportId: string;
    period: string;
    methodology: string;
    submissionDeadline?: Date;
    organizationInn?: string;
    organizationAddress?: string;
    emissionData: {
      scope1: number;
      scope2: number;
      scope3: number;
      total: number;
      sources?: {
        energy?: number;
        transport?: number;
        production?: number;
        waste?: number;
        suppliers?: number;
      };
    };
    variables?: Record<string, any>;
  },
  options: ReportGenerationOptions = {}
): Promise<ReportGenerationResult> {
  try {
    // Подготавливаем переменные для шаблона
    const now = new Date();

    // Преобразуем данные о выбросах в формат 296-ФЗ
    // Упрощенное распределение: scope1 -> CO2, scope2 -> CH4, scope3 -> N2O
    const co2_mass = reportData.emissionData.scope1 / 1; // GWP CO2 = 1
    const ch4_mass = reportData.emissionData.scope2 / 28; // GWP CH4 = 28
    const n2o_mass = reportData.emissionData.scope3 / 265; // GWP N2O = 265

    const emissionData: EmissionData = {
      co2_mass,
      ch4_mass,
      n2o_mass,
      hfc_mass: 0,
      pfc_mass: 0,
      sf6_mass: 0  // Убрано моковое значение 0.001 (было 23.5 тонн CO₂-экв)
    };

    const calculatedEmissions = calculateEmissions(emissionData);
    const rawEmissions = computeTotalCO2eRaw(emissionData);

    const templateData: ReportGenerationData = {
      org_name: reportData.organizationName,
      org_address: reportData.organizationAddress || 'Адрес не указан',
      org_inn: reportData.organizationInn || '0000000000',
      signer_name: reportData.variables?.responsible_person || 'Не указано',
      signer_position: 'Ответственный за отчетность',
      sign_date: now.toLocaleDateString('ru-RU'),
      generation_date: now.toLocaleDateString('ru-RU'),
      generation_time: now.toLocaleTimeString('ru-RU'),
      document_id: reportData.documentId,
      report_year: reportData.period,
      org_phone: reportData.variables?.phone_number || 'Не указано',
      org_email: reportData.variables?.email || 'Не указано',

      // Рассчитанные выбросы
      ...calculatedEmissions,

      // Дополнительные переменные
      ...reportData.variables
    };

    const result = await generateReport('296-FZ', templateData, options);

    if (result.success) {
      result.totalEmissionsRaw = rawEmissions.total;
    }

    return {
      ...result,
      meta: {
        organizationId: reportData.organizationId,
        documentId: reportData.documentId,
        reportId: reportData.reportId,
        emissionData: reportData.emissionData
      }
    };

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
    return {
      success: false,
      error: `Не удалось сгенерировать полный отчет 296-ФЗ: ${message}`
    };
  }
}

/**
 * Генерация отчета CBAM
 */
export async function generateCBAMReport(
  data: ReportGenerationData,
  options?: ReportGenerationOptions
): Promise<ReportGenerationResult> {
  return generateReport('CBAM', data, options);
}

/**
 * Генерация отчета Carbon Footprint (CF)
 */
export async function generateCFReport(
  data: ReportGenerationData,
  options?: ReportGenerationOptions
): Promise<ReportGenerationResult> {
  return generateReport('CF', data, options);
}