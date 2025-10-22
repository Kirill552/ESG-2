import { prisma } from '../lib/prisma';

async function main() {
  const admin = await prisma.adminUser.findUnique({
    where: { email: 'whirpy@yandex.ru' },
    include: { webAuthnCredentials: true },
  });

  if (!admin) {
    console.log('Админ не найден');
    process.exit(1);
  }

  console.log('Администратор:', admin.email);
  console.log('Всего Passkey:', admin.webAuthnCredentials.length);

  if (admin.webAuthnCredentials.length > 0) {
    console.log('\nPasskey в БД:');
    admin.webAuthnCredentials.forEach((cred, i) => {
      console.log(`\n${i + 1}. ID: ${cred.id}`);
      console.log(`   credentialId: ${cred.credentialId.substring(0, 40)}...`);
      console.log(`   Создан: ${cred.createdAt.toISOString()}`);
    });
  } else {
    console.log('\n❌ В БД НЕТ Passkey!');
  }

  await prisma.$disconnect();
}

main();
