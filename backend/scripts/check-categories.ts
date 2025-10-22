/**
 * Проверка категорий документов в базе
 */

import prisma from '../lib/prisma';

async function checkCategories() {
  try {
    const docs = await prisma.document.findMany({
      where: {
        status: 'PROCESSED'
      },
      select: {
        id: true,
        fileName: true,
        category: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5
    });

    console.log('\n📊 Категории документов в базе:\n');
    docs.forEach(doc => {
      console.log(`${doc.fileName.substring(0, 50)}...`);
      console.log(`  Category: ${doc.category}`);
      console.log(`  Type: ${typeof doc.category}\n`);
    });

  } catch (error) {
    console.error('Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCategories();
