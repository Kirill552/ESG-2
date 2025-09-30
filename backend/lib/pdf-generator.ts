/**
 * PDF Generator с использованием Puppeteer
 * Поддерживает DejaVu Sans шрифты для кириллицы
 */

import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';

export interface PDFGenerationOptions {
  format?: 'A4' | 'Letter';
  printBackground?: boolean;
  preferCSSPageSize?: boolean;
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
}

export interface PDFGenerationResult {
  success: boolean;
  filePath?: string;
  fileSize?: number;
  error?: string;
}

/**
 * Генерация PDF из HTML с поддержкой кириллических шрифтов
 */
export async function generatePDF(
  html: string,
  outputPath: string,
  options: PDFGenerationOptions = {}
): Promise<PDFGenerationResult> {
  let browser = null;
  let page = null;

  try {
    // Запускаем браузер
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--font-render-hinting=none'
      ]
    });

    page = await browser.newPage();

    // Устанавливаем HTML контент
    await page.setContent(html, {
      waitUntil: 'networkidle0'
    });

    // Ждем загрузки шрифтов
    await page.waitForTimeout(1000);

    // Проверяем, что шрифты загружены
    await page.evaluate(() => {
      return document.fonts.ready;
    });

    // Генерируем PDF
    const pdfOptions = {
      path: outputPath,
      format: options.format || 'A4' as const,
      printBackground: options.printBackground !== false,
      margin: options.margin || {
        top: '1cm',
        right: '1cm',
        bottom: '1cm',
        left: '1cm'
      }
    };

    const pdfBuffer = await page.pdf(pdfOptions);

    // Получаем размер файла
    const stats = await fs.stat(outputPath);

    return {
      success: true,
      filePath: outputPath,
      fileSize: stats.size
    };

  } catch (error) {
    console.error('Ошибка генерации PDF:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    };

  } finally {
    // Закрываем ресурсы
    if (page) {
      await page.close();
    }
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Проверка доступности шрифтов DejaVu Sans
 */
export async function checkFontsAvailability(): Promise<{
  available: boolean;
  missingFonts: string[];
}> {
  const requiredFonts = [
    'public/fonts/DejaVuSans.ttf',
    'public/fonts/DejaVuSans-Bold.ttf'
  ];

  const missingFonts: string[] = [];

  for (const fontPath of requiredFonts) {
    try {
      await fs.access(fontPath);
    } catch {
      missingFonts.push(fontPath);
    }
  }

  return {
    available: missingFonts.length === 0,
    missingFonts
  };
}

/**
 * Создание директории для отчетов если не существует
 */
export async function ensureReportsDirectory(dirPath: string): Promise<void> {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

/**
 * Генерация уникального имени файла для отчета
 */
export function generateReportFileName(
  reportType: '296-FZ' | 'CBAM' | 'CF',
  orgName: string,
  reportPeriod: string
): string {
  const timestamp = new Date().toISOString().slice(0, 10);
  const sanitizedOrgName = orgName
    .replace(/[^a-zA-Zа-яА-Я0-9]/g, '_')
    .substring(0, 20);

  return `${reportType}_${sanitizedOrgName}_${reportPeriod}_${timestamp}.pdf`;
}

/**
 * Основная функция для генерации отчета в PDF
 */
export async function generateReportPDF(
  html: string,
  reportType: '296-FZ' | 'CBAM' | 'CF',
  orgName: string,
  reportPeriod: string,
  outputDir: string = 'public/reports'
): Promise<PDFGenerationResult> {
  try {
    // Проверяем доступность шрифтов
    const fontsCheck = await checkFontsAvailability();
    if (!fontsCheck.available) {
      console.warn('⚠️ Отсутствуют шрифты DejaVu Sans:', fontsCheck.missingFonts);
    }

    // Создаем директорию для отчетов
    await ensureReportsDirectory(outputDir);

    // Генерируем имя файла
    const fileName = generateReportFileName(reportType, orgName, reportPeriod);
    const outputPath = path.join(outputDir, fileName);

    // Генерируем PDF
    const result = await generatePDF(html, outputPath, {
      format: 'A4',
      printBackground: true,
      margin: {
        top: '1cm',
        right: '1cm',
        bottom: '1cm',
        left: '1cm'
      }
    });

    if (result.success) {
      console.log(`✅ PDF отчет создан: ${fileName} (${result.fileSize} bytes)`);
    }

    return result;

  } catch (error) {
    console.error('Ошибка создания PDF отчета:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    };
  }
}