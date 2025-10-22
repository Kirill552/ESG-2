import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import prisma from '@/lib/prisma';
import { getUserDataByMode } from '@/lib/user-mode-utils';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: reportId } = await params;
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

    // Получаем данные организации пользователя
    const organization = await prisma.organization.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        name: true,
        inn: true,
        address: true,
        phone: true, // Старое поле (deprecated)
        email: true, // Старое поле (deprecated)
        profile: {
          select: {
            kpp: true,
            ogrn: true,
            okpo: true,
            oktmo: true,
            legalAddress: true,
            directorName: true,
            directorPosition: true,
            phone: true, // Корректное поле телефона из профиля
            emailForBilling: true, // Корректное поле email из профиля
            opfCode: true, // Код организационно-правовой формы
            opfFull: true, // Полное название ОПФ
            opfShort: true, // Краткое название ОПФ (ООО, АО, и т.д.)
          }
        }
      }
    });

    // Если организация не заполнена, возвращаем ошибку
    if (!organization || !organization.name || !organization.inn) {
      return NextResponse.json(
        {
          error: 'Organization data not found',
          message: 'Please fill in your organization details in Settings before downloading reports'
        },
        { status: 400 }
      );
    }

    // Отчет всегда готов к скачиванию (статус READY устанавливается при создании)

    // Генерируем PDF отчет с помощью enhanced-report-generator
    try {
      const { generate296FZFullReport } = await import('@/lib/enhanced-report-generator');

      // Подготавливаем данные для генерации отчета
      const totalEmissions = report.totalEmissions || 0;

      const reportData = {
        organizationId: organization.id,
        organizationName: organization.name,
        documentId: report.id,
        reportId: report.id,
        period: report.period || new Date().getFullYear().toString(),
        reportPeriodStart: report.reportPeriodStart,
        reportPeriodEnd: report.reportPeriodEnd,
        methodology: report.methodology || '296-ФЗ от 02.07.2021',
        submissionDeadline: report.submissionDeadline,
        organizationInn: organization.inn,
        organizationKpp: organization.profile?.kpp || '',
        organizationOgrn: organization.profile?.ogrn || '',
        organizationOkpo: organization.profile?.okpo || '',
        organizationOktmo: organization.profile?.oktmo || '',
        organizationAddress: organization.profile?.legalAddress || organization.address || 'Не указан',
        organizationLegalForm: organization.profile?.opfShort || 'Не указана',
        emissionData: {
          scope1: totalEmissions * 0.4,
          scope2: totalEmissions * 0.4,
          scope3: totalEmissions * 0.2,
          total: totalEmissions,
          sources: {
            energy: totalEmissions * 0.3,
            transport: totalEmissions * 0.5,
            production: totalEmissions * 0.1,
            waste: totalEmissions * 0.05,
            suppliers: totalEmissions * 0.05
          }
        },
        variables: {
          responsible_person: organization.profile?.directorName || 'Не указан',
          responsible_position: organization.profile?.directorPosition || '',
          phone_number: organization.profile?.phone || organization.phone || 'Не указан',
          email: organization.profile?.emailForBilling || organization.email || session.user!.email || 'Не указан'
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
      // Кодируем имя файла для поддержки кириллицы в HTTP заголовке
      const encodedFileName = encodeURIComponent(fileName);

      const response = new NextResponse(result.pdf);
      response.headers.set('Content-Type', 'application/pdf');
      response.headers.set('Content-Disposition', `attachment; filename*=UTF-8''${encodedFileName}`);
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