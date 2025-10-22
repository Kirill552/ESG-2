import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateDraftToReady() {
  try {
    const result = await prisma.report.updateMany({
      where: { status: 'DRAFT' },
      data: { status: 'READY' }
    });

    console.log(`✅ Updated ${result.count} reports from DRAFT to READY`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateDraftToReady();
