/**
 * GET /api/reports/validate
 * Проверяет готовность организации к генерации отчета 296-ФЗ
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { validateOrganizationForReport } from '@/lib/report-validator';

export async function GET(req: NextRequest) {
  try {
    // Проверка авторизации
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Необходима авторизация' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Выполняем валидацию
    const validationResult = await validateOrganizationForReport(userId);

    return NextResponse.json({
      success: true,
      ...validationResult
    });

  } catch (error) {
    console.error('[Reports Validate API] Error:', error);

    return NextResponse.json(
      { error: 'Ошибка при проверке данных организации' },
      { status: 500 }
    );
  }
}
