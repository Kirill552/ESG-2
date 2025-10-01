/**
 * Проверка полноты данных организации перед генерацией отчета
 * Используется в API endpoint для генерации отчетов 296-ФЗ
 */

import { prisma } from '@/lib/prisma';
import { validateOrganizationData, formatMissingFieldsMessage, generateDataQualityWarnings } from '@/lib/organization-validator';
import { Logger } from '@/lib/logger';

const logger = new Logger('organization-completeness-check');

export interface OrganizationCompletenessResult {
  isComplete: boolean;
  missingFields: string[];
  warnings: string[];
  message?: string;
  organizationData?: any;
}

/**
 * Проверка полноты реквизитов организации пользователя
 */
export async function checkOrganizationCompleteness(
  userId: string
): Promise<OrganizationCompletenessResult> {
  try {
    logger.info('Checking organization completeness', { userId });

    // Получаем организацию и профиль пользователя
    const organization = await prisma.organization.findUnique({
      where: { userId },
      include: { profile: true },
    });

    if (!organization) {
      logger.warn('Organization not found for user', { userId });
      return {
        isComplete: false,
        missingFields: ['Организация не зарегистрирована'],
        warnings: [],
        message: 'Необходимо зарегистрировать организацию в настройках.',
      };
    }

    if (!organization.profile) {
      logger.warn('Organization profile not found', { userId, organizationId: organization.id });
      return {
        isComplete: false,
        missingFields: ['Профиль организации не заполнен'],
        warnings: [],
        message: 'Необходимо заполнить реквизиты организации в настройках.',
      };
    }

    const profile = organization.profile;

    // Подготавливаем данные для валидации
    const organizationData = {
      inn: profile.inn,
      kpp: profile.kpp,
      ogrn: profile.ogrn,
      fullName: profile.fullName,
      shortName: profile.shortName,
      legalAddress: profile.legalAddress,
      okved: profile.okved,
      oktmo: profile.oktmo,
      okpo: profile.okpo,
      directorName: profile.directorName,
      directorPosition: profile.directorPosition,
    };

    // Валидация данных
    const validationResult = validateOrganizationData(organizationData);

    // Проверка качества данных
    const qualityWarnings = generateDataQualityWarnings(organizationData);

    const allWarnings = [...validationResult.warnings, ...qualityWarnings];

    logger.info('Organization completeness check completed', {
      userId,
      organizationId: organization.id,
      isComplete: validationResult.isValid,
      missingFieldsCount: validationResult.missingFields.length,
      warningsCount: allWarnings.length,
    });

    return {
      isComplete: validationResult.isValid,
      missingFields: validationResult.missingFields,
      warnings: allWarnings,
      message: validationResult.isValid
        ? 'Все обязательные реквизиты заполнены.'
        : formatMissingFieldsMessage(validationResult.missingFields),
      organizationData: validationResult.isValid ? organizationData : undefined,
    };
  } catch (error) {
    logger.error('Failed to check organization completeness', {
      userId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return {
      isComplete: false,
      missingFields: ['Ошибка при проверке данных организации'],
      warnings: [],
      message: 'Произошла ошибка при проверке данных. Попробуйте позже.',
    };
  }
}

/**
 * API endpoint helper: проверка и возврат ошибки если данные неполные
 */
export async function ensureOrganizationComplete(userId: string): Promise<{
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
    missingFields: string[];
    warnings: string[];
  };
}> {
  const check = await checkOrganizationCompleteness(userId);

  if (!check.isComplete) {
    return {
      success: false,
      error: {
        code: 'ORGANIZATION_INCOMPLETE',
        message: check.message || 'Необходимо дополнить данные организации.',
        missingFields: check.missingFields,
        warnings: check.warnings,
      },
    };
  }

  return {
    success: true,
    data: check.organizationData,
  };
}
