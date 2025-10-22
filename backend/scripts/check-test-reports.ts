import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkReports() {
  const reports = await prisma.report.findMany({
    where: {
      name: {
        contains: 'Тестовый'
      }
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 5,
    include: {
      user: {
        select: {
          email: true,
          name: true
        }
      }
    }
  });

  console.log('\n📊 Найдено тестовых отчетов:', reports.length);
  console.log('\n');

  reports.forEach((report, index) => {
    console.log(`\n${index + 1}. ${report.name}`);
    console.log(`   ID: ${report.id}`);
    console.log(`   Пользователь: ${report.user.email}`);
    console.log(`   Период: ${report.period}`);
    console.log(`   Статус: ${report.status}`);
    console.log(`   Выбросы: ${report.totalEmissions} тСО₂-экв`);
    console.log(`   Документов: ${report.documentCount}`);
    console.log(`   Файл: ${report.filePath}`);
    console.log(`   Дедлайн: ${report.submissionDeadline}`);
    console.log(`   Создан: ${report.createdAt}`);
  });

  await prisma.$disconnect();
}

checkReports();
