/**
 * Скрипт для удаления всех Passkey у администратора
 * Используется для очистки старых Passkey с неправильным RP ID
 */

import { prisma } from '../lib/prisma';

async function main() {
  const email = 'whirpy@yandex.ru';

  console.log(`🔍 Поиск администратора: ${email}...\n`);

  const admin = await prisma.adminUser.findUnique({
    where: { email },
    include: {
      webAuthnCredentials: true,
    },
  });

  if (!admin) {
    console.log('❌ Администратор не найден');
    return;
  }

  console.log(`👤 Администратор найден: ${admin.email}`);
  console.log(`   Текущих Passkey: ${admin.webAuthnCredentials.length}`);

  if (admin.webAuthnCredentials.length === 0) {
    console.log('\n✅ Нет Passkey для удаления');
    return;
  }

  console.log('\n🔑 Текущие Passkey:');
  for (const cred of admin.webAuthnCredentials) {
    console.log(`   - ID: ${cred.id}`);
    console.log(`     credentialId: ${cred.credentialId.substring(0, 30)}...`);
    console.log(`     Создан: ${cred.createdAt.toLocaleString('ru-RU')}`);
  }

  // Удаляем все Passkey
  console.log('\n🗑️ Удаление всех Passkey...');
  const deleted = await prisma.adminWebAuthnCredential.deleteMany({
    where: { adminId: admin.id },
  });

  console.log(`✅ Удалено Passkey: ${deleted.count}`);
  console.log('\n💡 Теперь можно зарегистрировать новый Passkey через UI с правильным RP ID');
}

main()
  .catch((error) => {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
