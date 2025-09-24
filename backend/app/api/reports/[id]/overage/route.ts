import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { loadMonetizationConfig } from '@/lib/monetization-config';

/**
 * API для получения данных о превышении лимитов отчета
 * GET /api/reports/[id]/overage
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json(
        { error: 'Требуется авторизация' },
        { status: 401 }
      );
    }

    // Получение организации пользователя
    const organization = await prisma.organization.findFirst({
      where: { userId: userId }
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Организация не найдена' },
        { status: 404 }
      );
    }

    // Получение отчета
    const report = await prisma.report.findFirst({
      where: { 
        id: params.id,
        userId: userId
      }
    });

    if (!report) {
      return NextResponse.json(
        { error: 'Отчет не найден' },
        { status: 404 }
      );
    }

    // Получение текущей подписки
  const subscription = await prisma.organization_subscriptions.findFirst({
      where: { 
    organizationId: organization.id,
    status: 'ACTIVE'
      }
    });

    if (!subscription) {
      return NextResponse.json(
        { error: 'Активная подписка не найдена' },
        { status: 404 }
      );
    }

    // Загрузка конфигурации тарифов
    const monetizationConfig = await loadMonetizationConfig();
    
    // Определение лимитов и ставок для текущего плана
  const planKey = (subscription.plan_type as 'FREE'|'TRIAL'|'LITE'|'STANDARD'|'LARGE'|'CBAM_ADDON').toLowerCase();
  const planConfig = monetizationConfig[planKey as keyof typeof monetizationConfig];
    
    if (!planConfig || typeof planConfig === 'object' && 'durationDays' in planConfig) {
      return NextResponse.json(
        { error: 'Конфигурация плана не найдена' },
        { status: 500 }
      );
    }

    const planLimit = (planConfig as any).maxEmissions || 0;
    const ratePerTon = (planConfig as any).ratePerTon || 0;

    // Извлечение общего объема выбросов из данных отчета
    // Данные хранятся в поле emissionData (Json)
    let totalEmissions = 0;
    
    if (report.emissionData && typeof report.emissionData === 'object') {
      const data = report.emissionData as any;
      
      // Пытаемся найти общий объем выбросов в различных полях
      totalEmissions = data.totalEmissions || 
                      data.total_emissions || 
                      data.emissions_total || 
                      data.co2_total || 
                      0;
    }

    // Если не удалось извлечь из JSON, пытаемся найти в других полях
  // Если не удалось извлечь из JSON, оставляем 0

    // Расчет превышения
    const excessEmissions = Math.max(0, totalEmissions - planLimit);
    const totalCost = Math.round(excessEmissions * ratePerTon);

    // Проверка, была ли уже произведена доплата
    const existingPayment = await prisma.emissionOveragePayment.findFirst({
      where: { 
        reportId: params.id,
        organizationId: organization.id
      }
    });

    const response = {
      reportId: params.id,
  reportName: `Отчет от ${report.createdAt.toLocaleDateString('ru-RU')}`,
  currentPlan: subscription.plan_type,
      planLimit: planLimit,
      actualEmissions: totalEmissions,
      excessEmissions: excessEmissions,
      ratePerTon: ratePerTon,
      totalCost: totalCost,
      basePlanCost: (planConfig as any).basePayment || 0,
      alreadyPaid: !!existingPayment
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Ошибка получения данных о превышении:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}
