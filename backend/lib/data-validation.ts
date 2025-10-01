/**
 * Валидация извлеченных данных о выбросах
 * Проверяет корректность и полноту данных перед расчетами
 */

import { Logger } from './logger';
import { isSupportedUnit, convertToStandardUnits } from './unit-conversion';

const logger = new Logger('data-validation');

export interface FuelDataRecord {
  type: string;          // Тип топлива
  volume?: number;       // Объем потребления
  unit?: string;         // Единица измерения
  source?: string;       // Источник (котельная, цех, и т.д.)
  period?: string;       // Период
}

export interface ElectricityDataRecord {
  consumption: number;   // Потребление
  unit: string;          // Единица измерения (кВт·ч, МВт·ч)
  source?: string;       // Источник
  period?: string;       // Период
}

export interface TransportDataRecord {
  vehicle_type?: string; // Тип транспорта
  fuel_type?: string;    // Тип топлива
  distance?: number;     // Пробег
  fuel_consumed?: number; // Расход топлива
  unit?: string;         // Единица измерения
  period?: string;       // Период
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  normalizedData?: any;
}

/**
 * Валидация данных о топливе
 */
export function validateFuelData(records: FuelDataRecord[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const normalizedData: FuelDataRecord[] = [];

  logger.info('Validating fuel data', { recordsCount: records.length });

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const recordErrors: string[] = [];
    const recordWarnings: string[] = [];

    // Проверка обязательных полей
    if (!record.type || record.type.trim() === '') {
      recordErrors.push(`Запись ${i + 1}: не указан тип топлива`);
    }

    if (record.volume === undefined || record.volume === null) {
      recordErrors.push(`Запись ${i + 1}: не указан объем потребления`);
    } else if (record.volume <= 0) {
      recordErrors.push(`Запись ${i + 1}: объем потребления должен быть больше нуля`);
    } else if (record.volume > 1000000000) {
      recordWarnings.push(`Запись ${i + 1}: подозрительно большое значение (${record.volume})`);
    }

    if (!record.unit || record.unit.trim() === '') {
      recordErrors.push(`Запись ${i + 1}: не указана единица измерения`);
    } else if (!isSupportedUnit(record.unit)) {
      recordErrors.push(`Запись ${i + 1}: неподдерживаемая единица измерения "${record.unit}"`);
    }

    // Рекомендации
    if (!record.source) {
      recordWarnings.push(`Запись ${i + 1}: рекомендуется указать источник (котельная, цех и т.д.)`);
    }

    if (!record.period) {
      recordWarnings.push(`Запись ${i + 1}: рекомендуется указать период`);
    }

    // Нормализация данных
    if (recordErrors.length === 0 && record.unit) {
      const conversionResult = convertToStandardUnits(record.volume!, record.unit);

      if (conversionResult.success) {
        normalizedData.push({
          ...record,
          volume: conversionResult.value,
          unit: conversionResult.standardUnit,
        });
      } else {
        recordErrors.push(`Запись ${i + 1}: ошибка конвертации единиц - ${conversionResult.error}`);
      }
    }

    errors.push(...recordErrors);
    warnings.push(...recordWarnings);
  }

  const isValid = errors.length === 0;

  logger.info('Fuel data validation completed', {
    recordsCount: records.length,
    isValid,
    errorsCount: errors.length,
    warningsCount: warnings.length,
  });

  return {
    isValid,
    errors,
    warnings,
    normalizedData: isValid ? normalizedData : undefined,
  };
}

/**
 * Валидация данных об электроэнергии
 */
export function validateElectricityData(records: ElectricityDataRecord[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const normalizedData: ElectricityDataRecord[] = [];

  logger.info('Validating electricity data', { recordsCount: records.length });

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const recordErrors: string[] = [];
    const recordWarnings: string[] = [];

    // Проверка потребления
    if (record.consumption === undefined || record.consumption === null) {
      recordErrors.push(`Запись ${i + 1}: не указано потребление`);
    } else if (record.consumption <= 0) {
      recordErrors.push(`Запись ${i + 1}: потребление должно быть больше нуля`);
    } else if (record.consumption > 10000000) {
      recordWarnings.push(`Запись ${i + 1}: подозрительно большое потребление (${record.consumption} ${record.unit})`);
    }

    // Проверка единиц
    if (!record.unit || record.unit.trim() === '') {
      recordErrors.push(`Запись ${i + 1}: не указана единица измерения`);
    } else if (!isSupportedUnit(record.unit)) {
      recordErrors.push(`Запись ${i + 1}: неподдерживаемая единица измерения "${record.unit}"`);
    }

    // Нормализация
    if (recordErrors.length === 0 && record.unit) {
      const conversionResult = convertToStandardUnits(record.consumption, record.unit);

      if (conversionResult.success) {
        normalizedData.push({
          ...record,
          consumption: conversionResult.value!,
          unit: conversionResult.standardUnit!,
        });
      } else {
        recordErrors.push(`Запись ${i + 1}: ошибка конвертации - ${conversionResult.error}`);
      }
    }

    errors.push(...recordErrors);
    warnings.push(...recordWarnings);
  }

  const isValid = errors.length === 0;

  logger.info('Electricity data validation completed', {
    recordsCount: records.length,
    isValid,
    errorsCount: errors.length,
  });

  return {
    isValid,
    errors,
    warnings,
    normalizedData: isValid ? normalizedData : undefined,
  };
}

/**
 * Валидация транспортных данных
 */
export function validateTransportData(records: TransportDataRecord[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const normalizedData: TransportDataRecord[] = [];

  logger.info('Validating transport data', { recordsCount: records.length });

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const recordErrors: string[] = [];
    const recordWarnings: string[] = [];

    // Должен быть указан хотя бы один показатель
    if (!record.distance && !record.fuel_consumed) {
      recordErrors.push(`Запись ${i + 1}: не указан ни пробег, ни расход топлива`);
    }

    // Проверка пробега
    if (record.distance !== undefined) {
      if (record.distance <= 0) {
        recordErrors.push(`Запись ${i + 1}: пробег должен быть больше нуля`);
      } else if (record.distance > 10000000) {
        recordWarnings.push(`Запись ${i + 1}: подозрительно большой пробег (${record.distance} км)`);
      }
    }

    // Проверка расхода топлива
    if (record.fuel_consumed !== undefined) {
      if (record.fuel_consumed <= 0) {
        recordErrors.push(`Запись ${i + 1}: расход топлива должен быть больше нуля`);
      } else if (record.fuel_consumed > 1000000) {
        recordWarnings.push(`Запись ${i + 1}: подозрительно большой расход топлива (${record.fuel_consumed})`);
      }

      if (!record.fuel_type) {
        recordWarnings.push(`Запись ${i + 1}: не указан тип топлива`);
      }
    }

    // Проверка типа транспорта
    if (!record.vehicle_type) {
      recordWarnings.push(`Запись ${i + 1}: рекомендуется указать тип транспорта`);
    }

    // Нормализация
    if (recordErrors.length === 0) {
      normalizedData.push(record);
    }

    errors.push(...recordErrors);
    warnings.push(...recordWarnings);
  }

  const isValid = errors.length === 0;

  logger.info('Transport data validation completed', {
    recordsCount: records.length,
    isValid,
    errorsCount: errors.length,
  });

  return {
    isValid,
    errors,
    warnings,
    normalizedData: isValid ? normalizedData : undefined,
  };
}

/**
 * Общая валидация всех извлеченных данных
 */
export function validateExtractedData(data: {
  fuel_data?: FuelDataRecord[];
  electricity_data?: ElectricityDataRecord[];
  transport_data?: TransportDataRecord[];
}): ValidationResult {
  const allErrors: string[] = [];
  const allWarnings: string[] = [];
  const normalizedData: any = {};

  logger.info('Validating all extracted data');

  // Проверка, что есть хотя бы какие-то данные
  const hasFuel = data.fuel_data && data.fuel_data.length > 0;
  const hasElectricity = data.electricity_data && data.electricity_data.length > 0;
  const hasTransport = data.transport_data && data.transport_data.length > 0;

  if (!hasFuel && !hasElectricity && !hasTransport) {
    allErrors.push('Не найдено данных о выбросах ни в одной категории');
    return {
      isValid: false,
      errors: allErrors,
      warnings: allWarnings,
    };
  }

  // Валидация топлива
  if (hasFuel) {
    const fuelValidation = validateFuelData(data.fuel_data!);
    allErrors.push(...fuelValidation.errors.map(e => `[Топливо] ${e}`));
    allWarnings.push(...fuelValidation.warnings.map(w => `[Топливо] ${w}`));

    if (fuelValidation.isValid) {
      normalizedData.fuel_data = fuelValidation.normalizedData;
    }
  }

  // Валидация электроэнергии
  if (hasElectricity) {
    const electricityValidation = validateElectricityData(data.electricity_data!);
    allErrors.push(...electricityValidation.errors.map(e => `[Электроэнергия] ${e}`));
    allWarnings.push(...electricityValidation.warnings.map(w => `[Электроэнергия] ${w}`));

    if (electricityValidation.isValid) {
      normalizedData.electricity_data = electricityValidation.normalizedData;
    }
  }

  // Валидация транспорта
  if (hasTransport) {
    const transportValidation = validateTransportData(data.transport_data!);
    allErrors.push(...transportValidation.errors.map(e => `[Транспорт] ${e}`));
    allWarnings.push(...transportValidation.warnings.map(w => `[Транспорт] ${w}`));

    if (transportValidation.isValid) {
      normalizedData.transport_data = transportValidation.normalizedData;
    }
  }

  const isValid = allErrors.length === 0;

  logger.info('Overall validation completed', {
    isValid,
    totalErrors: allErrors.length,
    totalWarnings: allWarnings.length,
    categoriesWithData: [
      hasFuel ? 'fuel' : null,
      hasElectricity ? 'electricity' : null,
      hasTransport ? 'transport' : null,
    ].filter(Boolean),
  });

  return {
    isValid,
    errors: allErrors,
    warnings: allWarnings,
    normalizedData: isValid ? normalizedData : undefined,
  };
}
