/**
 * Валидатор данных организации перед генерацией отчета 296-ФЗ
 * Проверяет наличие всех обязательных полей согласно Постановлению 707
 */

import { prisma } from './prisma';

export interface ValidationError {
  field: string;
  message: string;
  severity: 'critical' | 'warning';
  redirectUrl?: string;
}

export interface ValidationResult {
  canGenerate: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  missingFields: string[];
}

/**
 * Проверяет заполненность обязательных полей организации
 */
export async function validateOrganizationForReport(userId: string): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const missingFields: string[] = [];

  try {
    // Получаем организацию и профиль пользователя
    const organization = await prisma.organization.findUnique({
      where: { userId },
      include: { profile: true }
    });

    if (!organization) {
      errors.push({
        field: 'organization',
        message: 'Организация не найдена. Создайте организацию в настройках.',
        severity: 'critical',
        redirectUrl: '/settings'
      });
      return {
        canGenerate: false,
        errors,
        warnings,
        missingFields: ['organization']
      };
    }

    const profile = organization.profile;

    // === КРИТИЧЕСКИЕ ПОЛЯ (блокируют генерацию) ===

    // 1. ИНН - ОБЯЗАТЕЛЬНО
    if (!profile?.inn || profile.inn.trim().length === 0) {
      errors.push({
        field: 'inn',
        message: 'ИНН организации не указан',
        severity: 'critical',
        redirectUrl: '/settings?tab=organization'
      });
      missingFields.push('ИНН');
    }

    // 2. Полное наименование - ОБЯЗАТЕЛЬНО
    if (!profile?.fullName || profile.fullName.trim().length === 0) {
      errors.push({
        field: 'fullName',
        message: 'Полное наименование организации не указано',
        severity: 'critical',
        redirectUrl: '/settings?tab=organization'
      });
      missingFields.push('Полное наименование');
    }

    // 3. Краткое наименование - ЖЕЛАТЕЛЬНО
    if (!profile?.shortName || profile.shortName.trim().length === 0) {
      warnings.push({
        field: 'shortName',
        message: 'Краткое наименование не указано',
        severity: 'warning',
        redirectUrl: '/settings?tab=organization'
      });
    }

    // 4. ОГРН - ОБЯЗАТЕЛЬНО для 296-ФЗ
    if (!profile?.ogrn || profile.ogrn.trim().length === 0) {
      errors.push({
        field: 'ogrn',
        message: 'ОГРН не указан (обязательное поле для отчета 296-ФЗ)',
        severity: 'critical',
        redirectUrl: '/settings?tab=organization'
      });
      missingFields.push('ОГРН');
    }

    // 5. ОКПО - ОБЯЗАТЕЛЬНО для 296-ФЗ
    if (!profile?.okpo || profile.okpo.trim().length === 0) {
      errors.push({
        field: 'okpo',
        message: 'ОКПО не указан (обязательное поле для отчета 296-ФЗ)',
        severity: 'critical',
        redirectUrl: '/settings?tab=organization'
      });
      missingFields.push('ОКПО');
    }

    // 6. ОКТМО - ОБЯЗАТЕЛЬНО для 296-ФЗ
    if (!profile?.oktmo || profile.oktmo.trim().length === 0) {
      errors.push({
        field: 'oktmo',
        message: 'ОКТМО не указан (обязательное поле для отчета 296-ФЗ)',
        severity: 'critical',
        redirectUrl: '/settings?tab=organization'
      });
      missingFields.push('ОКТМО');
    }

    // 7. Юридический адрес - ОБЯЗАТЕЛЬНО
    if (!profile?.legalAddress || profile.legalAddress.trim().length === 0) {
      errors.push({
        field: 'legalAddress',
        message: 'Юридический адрес не указан',
        severity: 'critical',
        redirectUrl: '/settings?tab=organization'
      });
      missingFields.push('Юридический адрес');
    }

    // === ВАЖНЫЕ ПОЛЯ ДЛЯ КОНТАКТА ===

    // 8. Телефон контактного лица - ОБЯЗАТЕЛЬНО
    if (!profile?.phone || profile.phone.trim().length === 0) {
      errors.push({
        field: 'phone',
        message: 'Контактный телефон не указан',
        severity: 'critical',
        redirectUrl: '/settings?tab=organization'
      });
      missingFields.push('Контактный телефон');
    }

    // 9. Email - ЖЕЛАТЕЛЬНО
    if (!profile?.emailForBilling || profile.emailForBilling.trim().length === 0) {
      warnings.push({
        field: 'emailForBilling',
        message: 'Email для связи не указан',
        severity: 'warning',
        redirectUrl: '/settings?tab=organization'
      });
    }

    // === ДАННЫЕ РУКОВОДИТЕЛЯ ===

    // 10. ФИО руководителя - ОБЯЗАТЕЛЬНО для подписи
    if (!profile?.directorName || profile.directorName.trim().length === 0) {
      errors.push({
        field: 'directorName',
        message: 'ФИО руководителя не указано (требуется для подписи отчета)',
        severity: 'critical',
        redirectUrl: '/settings?tab=organization'
      });
      missingFields.push('ФИО руководителя');
    }

    // 11. Должность руководителя - ОБЯЗАТЕЛЬНО
    if (!profile?.directorPosition || profile.directorPosition.trim().length === 0) {
      errors.push({
        field: 'directorPosition',
        message: 'Должность руководителя не указана',
        severity: 'critical',
        redirectUrl: '/settings?tab=organization'
      });
      missingFields.push('Должность руководителя');
    }

    // === ПРОВЕРКА ДОКУМЕНТОВ ===

    // 12. Наличие обработанных документов
    const processedDocuments = await prisma.document.count({
      where: {
        userId,
        status: 'PROCESSED',
        ocrProcessed: true
      }
    });

    if (processedDocuments === 0) {
      warnings.push({
        field: 'documents',
        message: 'Нет обработанных документов для включения в отчет',
        severity: 'warning',
        redirectUrl: '/documents'
      });
    }

    // 13. Проверка документов с совпадающим ИНН (если ИНН указан)
    if (profile?.inn) {
      const matchingDocuments = await prisma.document.count({
        where: {
          userId,
          status: 'PROCESSED',
          ocrProcessed: true,
          innMatches: true
        }
      });

      if (matchingDocuments === 0 && processedDocuments > 0) {
        warnings.push({
          field: 'documents_inn_mismatch',
          message: `У вас есть ${processedDocuments} обработанных документов, но ни один из них не содержит ИНН вашей организации`,
          severity: 'warning',
          redirectUrl: '/documents'
        });
      }
    }

    // Определяем можно ли генерировать отчет
    const canGenerate = errors.length === 0;

    return {
      canGenerate,
      errors,
      warnings,
      missingFields
    };

  } catch (error) {
    console.error('Ошибка валидации организации:', error);

    return {
      canGenerate: false,
      errors: [{
        field: 'system',
        message: 'Произошла ошибка при проверке данных организации',
        severity: 'critical'
      }],
      warnings: [],
      missingFields: []
    };
  }
}

/**
 * Быстрая проверка - возвращает true если можно генерировать отчет
 */
export async function canGenerateReport(userId: string): Promise<boolean> {
  const result = await validateOrganizationForReport(userId);
  return result.canGenerate;
}

/**
 * Получить список недостающих полей для пользовательского сообщения
 */
export async function getMissingFieldsMessage(userId: string): Promise<string> {
  const result = await validateOrganizationForReport(userId);

  if (result.canGenerate) {
    return '';
  }

  if (result.missingFields.length === 0) {
    return 'Заполните все обязательные поля для генерации отчета';
  }

  return `Заполните следующие обязательные поля: ${result.missingFields.join(', ')}`;
}
