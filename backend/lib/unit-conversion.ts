/**
 * Утилиты для конвертации единиц измерения
 * Используются при обработке данных из документов и расчете выбросов
 */

import { Logger } from './logger';

const logger = new Logger('unit-conversion');

/**
 * Категории единиц измерения
 */
export enum UnitCategory {
  VOLUME = 'volume',       // Объем
  MASS = 'mass',           // Масса
  ENERGY = 'energy',       // Энергия
  DISTANCE = 'distance',   // Расстояние
}

/**
 * Поддерживаемые единицы измерения с коэффициентами перевода в базовые единицы
 */
const UNIT_CONVERSIONS = {
  // Объем (базовая единица: литр)
  volume: {
    'л': 1,
    'литр': 1,
    'литры': 1,
    'м³': 1000,
    'м3': 1000,
    'куб.м': 1000,
    'тыс.м³': 1000000,
    'тыс. м³': 1000000,
    'тысяч м³': 1000000,
    'млн.м³': 1000000000,
    'галлон': 3.78541,
    'баррель': 158.987,
  },

  // Масса (базовая единица: килограмм)
  mass: {
    'кг': 1,
    'килограмм': 1,
    'г': 0.001,
    'грамм': 0.001,
    'т': 1000,
    'тонн': 1000,
    'тонна': 1000,
    'тонны': 1000,
    'тыс.т': 1000000,
    'тыс. т': 1000000,
    'млн.т': 1000000000,
    'фунт': 0.453592,
  },

  // Энергия (базовая единица: кВт·ч)
  energy: {
    'кВт·ч': 1,
    'кВтч': 1,
    'кВт*ч': 1,
    'МВт·ч': 1000,
    'МВтч': 1000,
    'МВт*ч': 1000,
    'ГВт·ч': 1000000,
    'ГВтч': 1000000,
    'тыс.кВт·ч': 1000,
    'тыс. кВт·ч': 1000,
    'млн.кВт·ч': 1000000,
    'Дж': 0.000277778,
    'кДж': 0.277778,
    'МДж': 277.778,
    'ГДж': 277778,
    'Гкал': 1162.22,
  },

  // Расстояние (базовая единица: километр)
  distance: {
    'км': 1,
    'м': 0.001,
    'метр': 0.001,
    'метры': 0.001,
    'тыс.км': 1000,
    'тыс. км': 1000,
    'миля': 1.60934,
  },
};

/**
 * Определение категории единицы измерения
 */
function detectUnitCategory(unit: string): UnitCategory | null {
  const normalizedUnit = normalizeUnit(unit);

  for (const [category, units] of Object.entries(UNIT_CONVERSIONS)) {
    if (normalizedUnit in units) {
      return category as UnitCategory;
    }
  }

  logger.warn('Unknown unit category', { unit, normalizedUnit });
  return null;
}

/**
 * Нормализация единицы измерения (приведение к стандартному виду)
 */
function normalizeUnit(unit: string): string {
  return unit
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ') // Множественные пробелы → один пробел
    .replace(/\.$/, '');  // Удаляем точку в конце
}

/**
 * Конвертация значения из одной единицы в другую
 */
export function convertUnit(
  value: number,
  fromUnit: string,
  toUnit: string
): { success: boolean; value?: number; error?: string } {
  try {
    const fromCategory = detectUnitCategory(fromUnit);
    const toCategory = detectUnitCategory(toUnit);

    if (!fromCategory) {
      return {
        success: false,
        error: `Неизвестная единица измерения: ${fromUnit}`,
      };
    }

    if (!toCategory) {
      return {
        success: false,
        error: `Неизвестная единица измерения: ${toUnit}`,
      };
    }

    if (fromCategory !== toCategory) {
      return {
        success: false,
        error: `Несовместимые категории единиц: ${fromUnit} (${fromCategory}) и ${toUnit} (${toCategory})`,
      };
    }

    const normalizedFrom = normalizeUnit(fromUnit);
    const normalizedTo = normalizeUnit(toUnit);

    const conversions = UNIT_CONVERSIONS[fromCategory];
    const fromCoef = conversions[normalizedFrom as keyof typeof conversions];
    const toCoef = conversions[normalizedTo as keyof typeof conversions];

    if (!fromCoef || !toCoef) {
      return {
        success: false,
        error: `Коэффициент конвертации не найден для ${fromUnit} или ${toUnit}`,
      };
    }

    // Конвертация: value * fromCoef / toCoef
    const convertedValue = (value * fromCoef) / toCoef;

    logger.info('Unit conversion', {
      value,
      fromUnit,
      toUnit,
      fromCoef,
      toCoef,
      result: convertedValue,
    });

    return {
      success: true,
      value: convertedValue,
    };
  } catch (error) {
    logger.error('Unit conversion failed', {
      error: error instanceof Error ? error.message : String(error),
      value,
      fromUnit,
      toUnit,
    });

    return {
      success: false,
      error: 'Ошибка при конвертации единиц',
    };
  }
}

/**
 * Конвертация в стандартные единицы для расчетов 296-ФЗ
 */
export function convertToStandardUnits(
  value: number,
  unit: string
): { success: boolean; value?: number; standardUnit?: string; error?: string } {
  const category = detectUnitCategory(unit);

  if (!category) {
    return {
      success: false,
      error: `Неизвестная единица измерения: ${unit}`,
    };
  }

  // Стандартные единицы для расчетов 296-ФЗ
  const standardUnits: Record<UnitCategory, string> = {
    [UnitCategory.VOLUME]: 'тыс.м³',
    [UnitCategory.MASS]: 'т',
    [UnitCategory.ENERGY]: 'МВт·ч',
    [UnitCategory.DISTANCE]: 'км',
  };

  const standardUnit = standardUnits[category];

  const result = convertUnit(value, unit, standardUnit);

  if (!result.success) {
    return result;
  }

  return {
    success: true,
    value: result.value,
    standardUnit,
  };
}

/**
 * Автоматическая конвертация литров в тонны для жидкого топлива
 * Использует плотность топлива
 */
export function convertLitersToTons(
  liters: number,
  fuelType: string
): { success: boolean; tons?: number; error?: string } {
  // Плотности топлив (кг/л)
  const FUEL_DENSITIES: Record<string, number> = {
    'бензин': 0.74,
    'дизель': 0.84,
    'дт': 0.84,
    'дизельное топливо': 0.84,
    'мазут': 0.96,
    'керосин': 0.8,
    'сжиженный газ': 0.55,
    'пропан': 0.51,
    'бутан': 0.58,
  };

  const normalizedFuelType = fuelType.toLowerCase().trim();

  // Поиск подходящей плотности
  let density: number | undefined;
  for (const [fuel, d] of Object.entries(FUEL_DENSITIES)) {
    if (normalizedFuelType.includes(fuel)) {
      density = d;
      break;
    }
  }

  if (!density) {
    logger.warn('Unknown fuel density', { fuelType });
    return {
      success: false,
      error: `Неизвестный тип топлива для конвертации: ${fuelType}. Укажите массу в тоннах напрямую.`,
    };
  }

  // Конвертация: литры * плотность (кг/л) / 1000 = тонны
  const tons = (liters * density) / 1000;

  logger.info('Liters to tons conversion', {
    liters,
    fuelType: normalizedFuelType,
    density,
    tons,
  });

  return {
    success: true,
    tons,
  };
}

/**
 * Проверка, что единица измерения поддерживается
 */
export function isSupportedUnit(unit: string): boolean {
  return detectUnitCategory(unit) !== null;
}

/**
 * Получение всех поддерживаемых единиц для категории
 */
export function getSupportedUnits(category: UnitCategory): string[] {
  const conversions = UNIT_CONVERSIONS[category];
  return Object.keys(conversions);
}

/**
 * Форматирование числа с единицей измерения
 */
export function formatValueWithUnit(value: number, unit: string, decimals: number = 2): string {
  return `${value.toFixed(decimals)} ${unit}`;
}
