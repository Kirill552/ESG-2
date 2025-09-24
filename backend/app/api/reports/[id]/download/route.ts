import { NextRequest, NextResponse } from 'next/server';
export const maxDuration = 600;
import { PrismaClient, ReportType } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getUserInternalId } from '@/lib/user-utils';
import fs from 'fs';
import path from 'path';
import { generate296FZReport, generateCBAMReport, generateCFReport, ReportGenerationData } from '@/lib/report-generator';

// RFC5987 encoder for safe Content-Disposition with non-ASCII filenames
function encodeRFC5987(value: string) {
  return encodeURIComponent(value)
    .replace(/['()*]/g, c => '%' + c.charCodeAt(0).toString(16))
    .replace(/%(7C|60|5E)/g, '%25$1');
}

function buildAttachmentContentDisposition(fileName: string) {
  const asciiFallback = (fileName || 'report.pdf').replace(/[^\x20-\x7E]+/g, '_');
  const encoded = encodeRFC5987(fileName || 'report.pdf');
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
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
      <head><title>ESG Отчет 296-ФЗ</title></head>
      <body style="font-family: Arial; padding: 20px;">
        <h1>Отчет о выбросах парниковых газов</h1>
        <p><strong>Организация:</strong> ${data.companyName}</p>
        <p><strong>ИНН:</strong> ${data.inn}</p>
        <p><strong>Отчетный период:</strong> ${data.reportingPeriod}</p>
        <p><strong>Общие выбросы:</strong> ${data.totalEmissions} тCO₂-экв</p>
        <h2>Источники выбросов:</h2>
        <table border="1" style="border-collapse: collapse; width: 100%;">
          <tr><th>Источник</th><th>Активность</th><th>Единица</th><th>Коэффициент</th><th>Выбросы</th></tr>
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
        <p><strong>Дата создания:</strong> ${data.createdAt}</p>
      </body>
    </html>
  `;
  
  page.setDefaultTimeout(540000);
  page.setDefaultNavigationTimeout(540000);
  await page.setContent(html, { waitUntil: 'networkidle0', timeout: 540000 });
  const pdfBuffer = await page.pdf({ format: 'A4' });
  await browser.close();
  
  return Buffer.from(pdfBuffer);
}

async function generateCbamDeclarationPdf(data: CbamDeclarationData): Promise<Buffer> {
  // Временная заглушка - возвращаем простой PDF
  const puppeteer = require('puppeteer');
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  const html = `
    <html>
      <head><title>CBAM Декларация</title></head>
      <body style="font-family: Arial; padding: 20px;">
        <h1>CBAM Quarterly Declaration</h1>
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
  
  page.setDefaultTimeout(540000);
  page.setDefaultNavigationTimeout(540000);
  await page.setContent(html, { waitUntil: 'networkidle0', timeout: 540000 });
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
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    
    console.log(`🔍 [DOWNLOAD] Trying to access report with userId: ${userId}`);
    
    if (!userId) {
      console.log('❌ [DOWNLOAD] No userId found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Получаем внутренний ID пользователя
    const internalUserId = await getUserInternalId();
    console.log(`🔍 [DOWNLOAD] Internal userId: ${internalUserId}`);

    const { id } = await params;
    console.log(`🔍 [DOWNLOAD] Looking for report ID: ${id}`);

    // Находим отчет
    const report = await prisma.report.findFirst({
      where: { id, userId: internalUserId }
    });

    console.log(`🔍 [DOWNLOAD] Found report:`, report ? 'YES' : 'NO');

    if (!report) {
      // Пробуем найти отчет без userId для отладки
      const anyReport = await prisma.report.findFirst({
        where: { id }
      });
      console.log(`🔍 [DOWNLOAD] Report exists without userId filter:`, anyReport ? 'YES' : 'NO');
      if (anyReport) {
        console.log(`🔍 [DOWNLOAD] Report belongs to userId: ${anyReport.userId}`);
      }
      
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // Обновляем счетчик скачиваний
    await prisma.report.update({
      where: { id },
      data: { downloadCount: { increment: 1 } }
    });

    // Если файл уже существует, отправляем его
    if (report.filePath && fs.existsSync(report.filePath)) {
      const fileBuffer = fs.readFileSync(report.filePath);
      const response = new NextResponse(fileBuffer);
      
  response.headers.set('Content-Type', 'application/pdf');
  response.headers.set('Content-Disposition', buildAttachmentContentDisposition(report.fileName));
      
      console.log(`📥 Готовый отчет скачан: ${report.fileName}`);
      return response;
    }

    // Генерируем PDF в реальном времени
    console.log(`🔄 Генерация PDF для отчета: ${report.reportType}`);
    
    let pdfBuffer: Buffer;

    // Приводим emissionData к правильному типу
    const emissionData = report.emissionData as any;

    switch (report.reportType as string) {
      case 'REPORT_296FZ':
        // Генерируем 296-ФЗ отчет
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
        
        pdfBuffer = await generateEsgReportPdf(esgData);
        break;

      case 'CBAM_XML':
        // Генерируем CBAM отчет
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
            },
            {
              cnCode: '2710 12 410',
              goodType: 'Light petroleum distillates',
              quantity: '50.0',
              unit: 'tonnes',
              totalEmissions: '125.8'
            }
          ],
          totalQuantity: emissionData?.totalQuantity || '150.0 tonnes',
          totalEmissions: emissionData?.totalEmissions || '376.3',
          createdAt: new Date().toLocaleDateString('ru-RU')
        };
        
        pdfBuffer = await generateCbamDeclarationPdf(cbamData);
        break;

      case 'CARBON_FOOTPRINT': {
        // Маппим данные для CF шаблона и используем общий генератор
        const now = new Date();
        const cfData: ReportGenerationData = {
          org_name: emissionData?.companyName || 'Не указано',
          org_address: emissionData?.address || '',
          org_inn: emissionData?.inn || '0000000000',
          report_year: emissionData?.reportingPeriod || new Date().getFullYear().toString(),
          signer_name: emissionData?.signerName || 'Ответственное лицо',
          signer_position: emissionData?.signerPosition || 'Специалист по устойчивому развитию',
          signer_fio: emissionData?.signerFio || emissionData?.signerName || 'Ответственное лицо',
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
        const result = await generateCFReport(cfData, { templateDir: 'templates', outputDir: 'public/reports' });
        if (!result.success || !result.filePath) {
          throw new Error(result.error || 'Не удалось создать CF отчет');
        }
        pdfBuffer = fs.readFileSync(result.filePath);
        break;
      }

      default:
        throw new Error(`Неподдерживаемый тип отчета: ${report.reportType}`);
    }

    // Возвращаем PDF
    const response = new NextResponse(new Uint8Array(pdfBuffer));
  response.headers.set('Content-Type', 'application/pdf');
  response.headers.set('Content-Disposition', buildAttachmentContentDisposition(report.fileName));
    
    console.log(`✅ PDF сгенерирован и отправлен: ${report.fileName} (${pdfBuffer.length} байт)`);
    
    return response;

  } catch (error) {
    console.error('Ошибка генерации/скачивания отчета:', error);
    
    // В случае ошибки генерации, создаем простую заглушку
  // ASCII-only fallback PDF to avoid encoding issues
  const errorPdf = Buffer.from(`%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj
4 0 obj
<<
/Length 120
>>
stream
BT
/F1 12 Tf
100 700 Td
(Error generating report) Tj
0 -20 Td
(Error generating report) Tj
0 -20 Td
(Contact support) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000206 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
350
%%EOF`);

    const response = new NextResponse(errorPdf);
  response.headers.set('Content-Type', 'application/pdf');
  response.headers.set('Content-Disposition', buildAttachmentContentDisposition('error_report.pdf'));
    
    return response;
  }
} 