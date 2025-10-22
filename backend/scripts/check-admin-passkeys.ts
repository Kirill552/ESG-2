/**
 * Скрипт для проверки зарегистрированных Passkey у администраторов
 */

import { prisma } from '../lib/prisma';

async function main() {
  console.log('🔍 Проверка Passkey администраторов...\n');

  const admins = await prisma.adminUser.findMany({
    include: {
      webAuthnCredentials: true,
      recoveryCodes: true,
    },
  });

  for (const admin of admins) {
    console.log(`👤 Администратор: ${admin.email}`);
    console.log(`   ID: ${admin.id}`);
    console.log(`   Роль: ${admin.role}`);
    console.log(`   Активен: ${admin.isActive}`);
    console.log(`   Passkeys: ${admin.webAuthnCredentials.length}`);
    console.log(`   Recovery коды: ${admin.recoveryCodes.length}`);

    if (admin.webAuthnCredentials.length > 0) {
      console.log('\n   🔑 Зарегистрированные Passkey:');
      for (const cred of admin.webAuthnCredentials) {
        console.log(`   - ID: ${cred.credentialId.substring(0, 20)}...`);
        console.log(`     Транспорты: ${cred.transports.join(', ')}`);
        console.log(`     Создан: ${cred.createdAt.toLocaleString('ru-RU')}`);
      }
    }

    console.log('\n' + '='.repeat(60) + '\n');
  }

  console.log('✅ Проверка завершена');
}

main()
  .catch((error) => {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
