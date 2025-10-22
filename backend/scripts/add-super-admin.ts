import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function addSuperAdmin() {
  const email = 'whirpy@yandex.ru';

  try {
    // Проверяем, существует ли уже администратор
    const existingAdmin = await prisma.adminUser.findUnique({
      where: { email },
    });

    if (existingAdmin) {
      console.log('⚠️  Администратор уже существует:', existingAdmin.email);

      // Обновляем роль на SUPER_ADMIN если не так
      if (existingAdmin.role !== 'SUPER_ADMIN') {
        await prisma.adminUser.update({
          where: { email },
          data: {
            role: 'SUPER_ADMIN',
            isActive: true,
          },
        });
        console.log('✅ Роль обновлена на SUPER_ADMIN');
      } else {
        console.log('✅ Уже является SUPER_ADMIN');
      }
    } else {
      // Создаем временный пароль (можно поменять через reset)
      const tempPassword = Math.random().toString(36).slice(-12);
      const passwordHash = await bcrypt.hash(tempPassword, 10);

      // Создаем запись администратора
      const admin = await prisma.adminUser.create({
        data: {
          email,
          passwordHash,
          role: 'SUPER_ADMIN',
          isActive: true,
        },
      });

      console.log('✅ Создан SUPER_ADMIN:', admin.email);
      console.log('⚠️  Временный пароль:', tempPassword);
      console.log('   (Измените его сразу после первого входа!)');
    }

    console.log('\n🎉 Готово! Теперь можно логиниться через Passkey с email:', email);
    console.log('   URL: /admin/login');
  } catch (error) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

addSuperAdmin();
