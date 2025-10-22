import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

/**
 * POST /api/documents/update-category
 * Обновить категорию для выбранных документов
 */
export async function POST(request: NextRequest) {
  try {
    // Проверка авторизации через VK ID token (magic link)
    const cookieStore = await cookies();
    const authToken = cookieStore.get('auth-token')?.value;

    if (!authToken) {
      return NextResponse.json(
        { ok: false, message: 'Не авторизован' },
        { status: 401 }
      );
    }

    // Находим пользователя по токену magic link
    const magicLink = await prisma.magicLink.findFirst({
      where: {
        token: authToken,
        expiresAt: { gt: new Date() },
        usedAt: { not: null }, // Токен должен быть использован
      },
      include: { user: true },
    });

    if (!magicLink?.user) {
      return NextResponse.json(
        { ok: false, message: 'Не авторизован' },
        { status: 401 }
      );
    }

    const userId = magicLink.user.id;

    const body = await request.json();
    const { documentIds, category } = body;

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json(
        { ok: false, message: 'Не указаны документы для обновления' },
        { status: 400 }
      );
    }

    if (!category) {
      return NextResponse.json(
        { ok: false, message: 'Не указана категория' },
        { status: 400 }
      );
    }

    // Валидация категории
    const validCategories = ['PRODUCTION', 'SUPPLIERS', 'WASTE', 'TRANSPORT', 'ENERGY', 'OTHER', 'UNKNOWN'];
    const categoryMapping: Record<string, string> = {
      'PRODUCTION': 'Производство',
      'SUPPLIERS': 'Поставщики',
      'WASTE': 'Отходы',
      'TRANSPORT': 'Транспорт',
      'ENERGY': 'Энергия',
      'OTHER': 'Прочее',
      'UNKNOWN': 'Не определено'
    };

    let categoryToSet = category;

    // Если передали русское название, преобразуем в английское
    if (Object.values(categoryMapping).includes(category)) {
      const entry = Object.entries(categoryMapping).find(([_, ru]) => ru === category);
      if (entry) {
        categoryToSet = entry[0];
      }
    }

    if (!validCategories.includes(categoryToSet)) {
      return NextResponse.json(
        { ok: false, message: 'Недопустимая категория' },
        { status: 400 }
      );
    }

    // Обновляем категорию для всех выбранных документов
    const result = await prisma.document.updateMany({
      where: {
        id: { in: documentIds },
        userId: userId, // Проверяем что документы принадлежат пользователю
      },
      data: {
        category: categoryMapping[categoryToSet] || categoryToSet,
      }
    });

    console.log(`✅ Обновлена категория для ${result.count} документов на "${categoryMapping[categoryToSet]}"`);

    return NextResponse.json({
      ok: true,
      message: `Категория обновлена для ${result.count} документов`,
      updatedCount: result.count
    });

  } catch (error) {
    console.error('❌ Ошибка при обновлении категории:', error);
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : 'Внутренняя ошибка сервера'
      },
      { status: 500 }
    );
  }
}
