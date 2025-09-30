import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import prisma from '@/lib/prisma';
import { getUserDataByMode } from '@/lib/user-mode-utils';

interface RouteParams {
  params: {
    id: string;
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const reportId = params.id;
    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get('format') || 'pdf'; // pdf, excel

    // В демо-режиме возвращаем заглушку
    const isDemo = await getUserDataByMode('reports', async () => false);
    if (isDemo !== false) {
      return NextResponse.json(
        {
          error: 'Report download is not available in demo mode',
          message: 'This feature will be available after getting access to the full version'
        },
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

    // Проверяем что отчет принадлежит пользователю
    const report = await prisma.report.findFirst({
      where: {
        id: reportId,
        userId: user.id
      }
    });

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // Проверяем что отчет готов к скачиванию
    if (report.status !== 'READY') {
      return NextResponse.json(
        { error: 'Report is not ready for download. Please complete the report first.' },
        { status: 400 }
      );
    }

    // Генерируем PDF отчет с помощью enhanced-report-generator
    try {
      const { generate296FZFullReport } = await import('@/lib/enhanced-report-generator');

      // Подготавливаем данные для генерации отчета
      const reportData = {
        organizationId: user.id,
        organizationName: 'ООО "Тестовая Организация"', // TODO: получать из профиля пользователя
        documentId: report.id,
        reportId: report.id,
        period: report.period,
        methodology: '296-ФЗ от 02.07.2021',
        submissionDeadline: report.submissionDeadline,
        organizationInn: '1234567890', // TODO: получать из профиля пользователя
        organizationAddress: 'Москва, Россия', // TODO: получать из профиля пользователя
        emissionData: {
          scope1: Math.random() * 500 + 200, // TODO: реальные данные из OCR
          scope2: Math.random() * 800 + 300,
          scope3: Math.random() * 100,
          total: 0, // Будет рассчитано автоматически
          sources: {
            energy: Math.random() * 400 + 100,
            transport: Math.random() * 300 + 50,
            production: Math.random() * 200 + 100,
            waste: Math.random() * 50 + 10,
            suppliers: Math.random() * 100 + 20
          }
        }
      };

      // Генерируем отчет
      const result = await generate296FZFullReport(reportData, {
        writeToDisk: false // Не сохраняем на диск, возвращаем Buffer
      });

      if (!result.success || !result.pdf) {
        return NextResponse.json(
          { error: 'Failed to generate report', details: result.error },
          { status: 500 }
        );
      }

      // Обновляем счетчик скачиваний
      await prisma.report.update({
        where: { id: reportId },
        data: {
          downloadCount: { increment: 1 },
          lastDownload: new Date()
        }
      });

      // Возвращаем PDF файл
      const fileName = `${report.name?.replace(/\s+/g, '_') || 'report'}_${report.period}.pdf`;

      const response = new NextResponse(result.pdf);
      response.headers.set('Content-Type', 'application/pdf');
      response.headers.set('Content-Disposition', `attachment; filename="${fileName}"`);
      response.headers.set('Content-Length', result.pdf.length.toString());

      return response;

    } catch (error) {
      console.error('Error generating PDF report:', error);
      return NextResponse.json(
        { error: 'Failed to generate PDF report', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }

    // БУДУЩАЯ РЕАЛИЗАЦИЯ (когда будет готов генератор PDF):
    /*
    try {
      // Увеличиваем счетчик скачиваний
      await prisma.report.update({
        where: { id: reportId },
        data: {
          downloadCount: { increment: 1 },
          lastDownload: new Date()
        }
      });

      let fileBuffer: Buffer;
      let contentType: string;
      let fileName: string;

      if (format === 'excel') {
        // Генерация Excel отчета
        const excelGenerator = new ExcelReportGenerator();
        fileBuffer = await excelGenerator.generate296FZReport(report);
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        fileName = `${report.name.replace(/\s+/g, '_')}_${report.period}.xlsx`;
      } else {
        // Генерация PDF отчета (по умолчанию)
        const pdfGenerator = new PDFReportGenerator();
        fileBuffer = await pdfGenerator.generate296FZReport(report);
        contentType = 'application/pdf';
        fileName = `${report.name.replace(/\s+/g, '_')}_${report.period}.pdf`;
      }

      const response = new NextResponse(fileBuffer);
      response.headers.set('Content-Type', contentType);
      response.headers.set('Content-Disposition', `attachment; filename="${fileName}"`);
      response.headers.set('Content-Length', fileBuffer.length.toString());

      return response;
    } catch (error) {
      console.error('Error generating report:', error);
      return NextResponse.json({ error: 'Failed to generate report file' }, { status: 500 });
    }
    */

  } catch (error) {
    console.error('Error downloading report:', error);
    return NextResponse.json({ error: 'Failed to download report' }, { status: 500 });
  }
}