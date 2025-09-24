import { NextRequest, NextResponse } from 'next/server';
export const maxDuration = 600;
import { PrismaClient, ReportType } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getUserInternalId } from '@/lib/user-utils';
import fs from 'fs';
import path from 'path';
import { generate296FZReport, generateCBAMReport, generateCFReport, ReportGenerationData } from '@/lib/report-generator';
import { apiLogger } from '@/lib/logger';

// Хелпер: RFC 5987 для безопасного Content-Disposition
function encodeRFC5987(value: string) {
  return encodeURIComponent(value)
    .replace(/['()*]/g, c => '%' + c.charCodeAt(0).toString(16))
    .replace(/%(7C|60|5E)/g, '%25$1');
}

function buildInlineContentDisposition(fileName: string) {
  // ASCII-фоллбек для старых агентов и требований ByteString в undici
  const asciiFallback = (fileName || 'report.pdf').replace(/[^\x20-\x7E]+/g, '_');
  const encoded = encodeRFC5987(fileName || 'report.pdf');
  return `inline; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

// Типы для отчетов
interface EsgReportData {
  documentId: string;
  companyName: string;
  fullCompanyName: string;
  inn: string;
  ogrn: string;
  kpp: string;
  reportingPeriod: string;
  emissionSources: Array<{
    source: string;
    activity: string;
    unit: string;
    emissionFactor: string;
    emissions: string;
  }>;
  totalEmissions: string;
  methodology: string;
  createdAt: string;
}

interface CbamDeclarationData {
  documentId: string;
  companyName: string;
  eori: string;
  quarter: string;
  goods: Array<{
    cnCode: string;
    goodType: string;
    quantity: string;
    unit: string;
    totalEmissions: string;
  }>;
  totalQuantity: string;
  totalEmissions: string;
  createdAt: string;
}

// Функции генерации PDF (заглушки, пока не реализованы)
async function generateEsgReportPdf(data: EsgReportData): Promise<Buffer> {
  // Временная заглушка - возвращаем простой PDF
  const puppeteer = require('puppeteer');
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  const html = `
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Отчет 296-ФЗ</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #2563eb; }
          table { border-collapse: collapse; width: 100%; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
        </style>
      </head>
      <body>
        <h1>Отчет о выбросах парниковых газов (296-ФЗ)</h1>
        <p><strong>Организация:</strong> ${data.companyName}</p>
        <p><strong>Полное наименование:</strong> ${data.fullCompanyName}</p>
        <p><strong>ИНН:</strong> ${data.inn}</p>
        <p><strong>ОГРН:</strong> ${data.ogrn}</p>
        <p><strong>КПП:</strong> ${data.kpp}</p>
        <p><strong>Отчетный период:</strong> ${data.reportingPeriod}</p>
        <p><strong>Общие выбросы:</strong> ${data.totalEmissions} т CO₂-экв</p>
        <h2>Источники выбросов:</h2>
        <table>
          <tr><th>Источник</th><th>Активность</th><th>Единица</th><th>Фактор</th><th>Выбросы</th></tr>
          ${data.emissionSources.map(source => `
            <tr>
              <td>${source.source}</td>
              <td>${source.activity}</td>
              <td>${source.unit}</td>
              <td>${source.emissionFactor}</td>
              <td>${source.emissions}</td>
            </tr>
          `).join('')}
        </table>
        <p><strong>Методология:</strong> ${data.methodology}</p>
        <p><strong>Дата создания:</strong> ${data.createdAt}</p>
      </body>
    </html>
  `;
  
  await page.setContent(html);
  const pdfBuffer = await page.pdf({ format: 'A4' });
  await browser.close();
  
  return Buffer.from(pdfBuffer);
}

async function generateCbamDeclarationPdf(data: CbamDeclarationData): Promise<Buffer> {
  const puppeteer = require('puppeteer');
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  const html = `
    <html>
      <head>
        <meta charset="UTF-8">
        <title>CBAM Declaration</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #2563eb; }
          table { border-collapse: collapse; width: 100%; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
        </style>
      </head>
      <body>
        <h1>CBAM Declaration</h1>
        <p><strong>Company:</strong> ${data.companyName}</p>
        <p><strong>EORI:</strong> ${data.eori}</p>
        <p><strong>Quarter:</strong> ${data.quarter}</p>
        <p><strong>Total Emissions:</strong> ${data.totalEmissions} tCO₂-eq</p>
        <h2>Goods:</h2>
        <table border="1" style="border-collapse: collapse; width: 100%;">
          <tr><th>CN Code</th><th>Good Type</th><th>Quantity</th><th>Unit</th><th>Emissions</th></tr>
          ${data.goods.map(good => `
            <tr>
              <td>${good.cnCode}</td>
              <td>${good.goodType}</td>
              <td>${good.quantity}</td>
              <td>${good.unit}</td>
              <td>${good.totalEmissions}</td>
            </tr>
          `).join('')}
        </table>
        <p><strong>Created:</strong> ${data.createdAt}</p>
      </body>
    </html>
  `;
  
  await page.setContent(html);
  const pdfBuffer = await page.pdf({ format: 'A4' });
  await browser.close();
  
  return Buffer.from(pdfBuffer);
}

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    let stage = 'init';
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    apiLogger.info('[VIEW] Request', { userId, url: request.url });
    
    if (!userId) {
      apiLogger.warn('[VIEW] Unauthorized: no userId');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Получаем внутренний ID пользователя
    stage = 'resolve-internal-user';
    const internalUserId = await getUserInternalId();
    apiLogger.debug('[VIEW] Internal user resolved', { internalUserId });

    stage = 'read-params';
    const { id } = await params;
    apiLogger.info('[VIEW] Fetch report', { id });

    // Находим отчет
    stage = 'db-fetch-report';
    const report = await prisma.report.findFirst({
      where: { id, userId: internalUserId }
    });
    apiLogger.info('[VIEW] Report found?', { found: Boolean(report) });
    
    if (!report) {
      // Пробуем найти отчет без userId для отладки
      stage = 'db-fetch-report-any';
      const anyReport = await prisma.report.findFirst({
        where: { id }
      });
      apiLogger.warn('[VIEW] Report not owned by user', { exists: Boolean(anyReport), ownerUserId: anyReport?.userId });
      
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // Если файл уже существует, отправляем его
    stage = 'serve-existing-file';
    if (report.filePath && fs.existsSync(report.filePath)) {
      const fileBuffer = fs.readFileSync(report.filePath);
      const response = new NextResponse(fileBuffer);
      
      response.headers.set('Content-Type', 'application/pdf');
      // В заголовках только ASCII: добавляем filename* с RFC5987
      response.headers.set('Content-Disposition', buildInlineContentDisposition(report.fileName));
      apiLogger.info('[VIEW] Served existing PDF', { fileName: report.fileName, bytes: fileBuffer.length });
      return response;
    }

    // Генерируем PDF в реальном времени для просмотра
    stage = 'generate-runtime';
    apiLogger.info('[VIEW] Generate PDF runtime', { reportType: report.reportType });
    
    let pdfBuffer: Buffer;

    // Приводим emissionData к правильному типу
    const emissionData = report.emissionData as any;

    switch (report.reportType as string) {
      case 'REPORT_296FZ':
        // Генерируем 296-ФЗ отчет
        stage = 'prepare-296fz-data';
        const esgData: EsgReportData = {
          documentId: report.id,
          companyName: emissionData?.companyName || 'Не указано',
          fullCompanyName: emissionData?.fullCompanyName || emissionData?.companyName || 'Не указано',
          inn: emissionData?.inn || '0000000000',
          ogrn: emissionData?.ogrn || '0000000000000',
          kpp: emissionData?.kpp || '',
          reportingPeriod: emissionData?.reportingPeriod || new Date().getFullYear().toString(),
          emissionSources: emissionData?.emissionSources || [
            {
              source: 'Электроэнергия',
              activity: '1000',
              unit: 'кВт·ч',
              emissionFactor: '0.322',
              emissions: '322.0'
            },
            {
              source: 'Природный газ',
              activity: '500',
              unit: 'м³',
              emissionFactor: '2.349',
              emissions: '1174.5'
            }
          ],
          totalEmissions: emissionData?.totalEmissions || '1496.5',
          methodology: report.methodology || '296-ФЗ-2025',
          createdAt: new Date().toLocaleDateString('ru-RU')
        };
        
  stage = 'generate-296fz';
  pdfBuffer = await generateEsgReportPdf(esgData);
        break;

      case 'CBAM_XML':
        // Генерируем CBAM отчет
        stage = 'prepare-cbam-data';
        const cbamData: CbamDeclarationData = {
          documentId: report.id,
          companyName: emissionData?.companyName || 'Не указано',
          eori: emissionData?.eori || 'RU000000000000000',
          quarter: emissionData?.quarter || 'Q1 2025',
          goods: emissionData?.goods || [
            {
              cnCode: '7208 51 200',
              goodType: 'Steel sheets, hot-rolled',
              quantity: '100.0',
              unit: 'tonnes',
              totalEmissions: '250.5'
            }
          ],
          totalQuantity: emissionData?.totalQuantity || '100.0 tonnes',
          totalEmissions: emissionData?.totalEmissions || '250.5',
          createdAt: new Date().toLocaleDateString('ru-RU')
        };
        
  stage = 'generate-cbam';
  pdfBuffer = await generateCbamDeclarationPdf(cbamData);
        break;

  case 'CARBON_FOOTPRINT': {
        const now = new Date();
        const cfData: ReportGenerationData = {
          org_name: emissionData?.companyName || 'Не указано',
          org_address: emissionData?.address || '',
          org_inn: emissionData?.inn || '0000000000',
          report_year: emissionData?.reportingPeriod || new Date().getFullYear().toString(),
          signer_name: emissionData?.signerName || 'Ответственное лицо',
          signer_position: emissionData?.signerPosition || 'Специалист по устойчивому развитию',
          // ОБЯЗАТЕЛЬНЫЕ ПОЛЯ интерфейса ReportGenerationData (см. lib/report-generator.ts)
          // signer_fio и signer_pos требуются шаблоном 296-ФЗ, но для CF используем ту же семантику
          signer_fio: emissionData?.signerName || 'Ответственное лицо',
          signer_pos: emissionData?.signerPosition || 'Специалист по устойчивому развитию',
          sign_date: new Date().toLocaleDateString('ru-RU'),
          document_id: report.id,
          generation_date: now.toLocaleDateString('ru-RU'),
          generation_time: now.toLocaleTimeString('ru-RU'),
          scope1: String(emissionData?.scope1 ?? ''),
          scope2: String(emissionData?.scope2 ?? ''),
          scope3: String(emissionData?.scope3 ?? ''),
          total_co2e: String(emissionData?.totalEmissions ?? ''),
          intensity: emissionData?.intensity ? String(emissionData.intensity) : '',
          data_quality: emissionData?.dataQuality || '',
          methodology: emissionData?.methodology || 'Russian CF Standard 2025'
        };
        stage = 'generate-cf';
        const result = await generateCFReport(cfData, { templateDir: 'templates', outputDir: 'public/reports' });
        if (!result.success || !result.filePath) {
          const err = new Error(result.error || 'Не удалось создать CF отчет');
          (err as any).stage = stage;
          throw err;
        }
        pdfBuffer = fs.readFileSync(result.filePath);
        break;
      }
      default:
        const err = new Error(`Неподдерживаемый тип отчета: ${report.reportType}`);
        (err as any).stage = 'unsupported-type';
        throw err;
    }

  const response = new NextResponse(new Uint8Array(pdfBuffer));
  response.headers.set('Content-Type', 'application/pdf');
  // Не допускаем не-ASCII в заголовке
  response.headers.set('Content-Disposition', buildInlineContentDisposition(report.fileName));
    apiLogger.info('[VIEW] PDF generated', { fileName: report.fileName, bytes: pdfBuffer.length });
    return response;

  } catch (error) {
    const errObj = error as any;
    const stage = errObj?.stage || 'unknown';
    const message = errObj?.message ? String(errObj.message) : 'Unexpected error';
    const isUnsupported = message.includes('Неподдерживаемый тип отчета');
    const status = isUnsupported ? 422 : 500;
    apiLogger.error('Ошибка генерации PDF для просмотра', error instanceof Error ? error : new Error(String(error)), { stage, status });

  // Возвращаем JSON для UI, чтобы можно было отобразить ошибку пользователю
    return NextResponse.json({
      error: message,
      stage,
      hint: 'Попробуйте повторить позже или обратитесь в поддержку',
    }, { status });
  }
}
