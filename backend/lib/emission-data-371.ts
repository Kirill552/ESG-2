/**
 * Коэффициенты эмиссии парниковых газов
 * Источник: Приказ Минприроды России от 27.05.2022 N 371
 * "Об утверждении методических указаний по количественному определению объема выбросов парниковых газов"
 */

export interface EmissionFactor {
  co2: number; // Коэффициент эмиссии CO₂
  ch4?: number; // Коэффициент эмиссии CH₄ (метан)
  n2o?: number; // Коэффициент эмиссии N₂O (оксид азота)
  unit: string; // Единица измерения
  description?: string;
  source?: string;
}

/**
 * Потенциалы глобального потепления (GWP) для парниковых газов
 * Источник: IPCC AR5 (Fifth Assessment Report)
 */
export const GLOBAL_WARMING_POTENTIAL = {
  CO2: 1,      // CO₂ - базовый газ
  CH4: 28,     // Метан (CH₄) - в 28 раз сильнее CO₂ за 100 лет
  N2O: 265,    // Оксид азота (N₂O) - в 265 раз сильнее CO₂ за 100 лет
};

export interface FuelEmissionData {
  gasoline: EmissionFactor;
  diesel: EmissionFactor;
  natural_gas: EmissionFactor;
  lpg: EmissionFactor; // Сжиженный нефтяной газ
  coal: EmissionFactor;
  fuel_oil: EmissionFactor; // Мазут
  kerosene: EmissionFactor;
  coke: EmissionFactor; // Кокс
}

export interface ElectricityEmissionData {
  russia_avg: EmissionFactor;
  russia_2024: EmissionFactor; // Актуальный коэффициент на 2024 год
}

export interface HeatEmissionData {
  russia_avg: EmissionFactor;
  russia_2024: EmissionFactor; // Актуальный коэффициент на 2024 год
}

/**
 * Коэффициенты эмиссии для различных видов топлива
 * Приказ 371, Приложение 1, Таблица 1
 */
export const EMISSION_FACTORS_FUEL: FuelEmissionData = {
  // Бензин автомобильный
  gasoline: {
    co2: 2.31,
    unit: 'т CO₂/т топлива',
    description: 'Бензин автомобильный (все марки)',
    source: 'Приказ 371, Приложение 1'
  },

  // Дизельное топливо
  diesel: {
    co2: 2.67,
    unit: 'т CO₂/т топлива',
    description: 'Дизельное топливо',
    source: 'Приказ 371, Приложение 1'
  },

  // Природный газ
  natural_gas: {
    co2: 1.97,
    ch4: 0.001, // Утечки метана при сжигании природного газа
    n2o: 0.0001, // Выбросы N₂O при сжигании
    unit: 'т газа/тыс. м³',
    description: 'Природный газ естественный',
    source: 'Приказ 371, Приложение 1'
  },

  // Сжиженный нефтяной газ (пропан-бутан)
  lpg: {
    co2: 2.95,
    unit: 'т CO₂/т топлива',
    description: 'Сжиженный нефтяной газ (пропан-бутан)',
    source: 'Приказ 371, Приложение 1'
  },

  // Уголь каменный
  coal: {
    co2: 2.71,
    ch4: 0.002, // Выбросы метана при сжигании угля
    n2o: 0.0015, // Выбросы N₂O при сжигании угля (более высокие чем у газа)
    unit: 'т газа/т топлива',
    description: 'Уголь каменный (средний коэффициент)',
    source: 'Приказ 371, Приложение 1'
  },

  // Мазут топочный
  fuel_oil: {
    co2: 3.15,
    unit: 'т CO₂/т топлива',
    description: 'Мазут топочный',
    source: 'Приказ 371, Приложение 1'
  },

  // Керосин
  kerosene: {
    co2: 2.55,
    unit: 'т CO₂/т топлива',
    description: 'Керосин авиационный',
    source: 'Приказ 371, Приложение 1'
  },

  // Кокс нефтяной
  coke: {
    co2: 3.57,
    unit: 'т CO₂/т топлива',
    description: 'Кокс нефтяной',
    source: 'Приказ 371, Приложение 1'
  }
};

/**
 * Коэффициенты эмиссии для электроэнергии
 * Приказ 371, Приложение 2
 */
export const EMISSION_FACTORS_ELECTRICITY: ElectricityEmissionData = {
  // Средний коэффициент для России
  russia_avg: {
    co2: 0.47,
    unit: 'т CO₂/МВт·ч',
    description: 'Средний коэффициент для ЕЭС России',
    source: 'Приказ 371, Приложение 2'
  },

  // Актуальный коэффициент на 2024 год
  russia_2024: {
    co2: 0.45,
    unit: 'т CO₂/МВт·ч',
    description: 'Актуальный коэффициент для ЕЭС России (2024)',
    source: 'Минэнерго России, 2024'
  }
};

/**
 * Коэффициенты эмиссии для теплоэнергии
 * Приказ 371, Приложение 2
 */
export const EMISSION_FACTORS_HEAT: HeatEmissionData = {
  // Средний коэффициент для России
  russia_avg: {
    co2: 0.27,
    unit: 'т CO₂/Гкал',
    description: 'Средний коэффициент для теплоэнергии в России',
    source: 'Приказ 371, Приложение 2'
  },

  // Актуальный коэффициент на 2024 год
  russia_2024: {
    co2: 0.26,
    unit: 'т CO₂/Гкал',
    description: 'Актуальный коэффициент для теплоэнергии (2024)',
    source: 'Росстат, 2024'
  }
};

/**
 * Полная структура данных по эмиссиям
 */
export const EMISSION_DATA_371 = {
  fuel: EMISSION_FACTORS_FUEL,
  electricity: EMISSION_FACTORS_ELECTRICITY,
  heat: EMISSION_FACTORS_HEAT
};

/**
 * Преобразование единиц измерения топлива
 */
export const FUEL_CONVERSION_FACTORS = {
  // Бензин: литры в тонны (плотность ~0.75 кг/л)
  gasoline_l_to_t: 0.00075,

  // Дизель: литры в тонны (плотность ~0.84 кг/л)
  diesel_l_to_t: 0.00084,

  // Природный газ: м³ в тыс. м³
  natural_gas_m3_to_thous_m3: 0.001,

  // Электроэнергия: кВт·ч в МВт·ч
  electricity_kwh_to_mwh: 0.001,

  // Теплоэнергия: Гкал (без преобразования)
  heat_gcal: 1
};

/**
 * Функция для расчета выбросов CO₂ из топлива
 */
export function calculateFuelEmissions(
  fuelType: keyof FuelEmissionData,
  amount: number,
  unit: 'л' | 'т' | 'м³' | 'тыс. м³'
): number {
  const emissionFactor = EMISSION_FACTORS_FUEL[fuelType];
  if (!emissionFactor) {
    throw new Error(`Unknown fuel type: ${fuelType}`);
  }

  let amountInStandardUnit = amount;

  // Преобразуем в стандартные единицы
  if (fuelType === 'gasoline' && unit === 'л') {
    amountInStandardUnit = amount * FUEL_CONVERSION_FACTORS.gasoline_l_to_t;
  } else if (fuelType === 'diesel' && unit === 'л') {
    amountInStandardUnit = amount * FUEL_CONVERSION_FACTORS.diesel_l_to_t;
  } else if (fuelType === 'natural_gas' && unit === 'м³') {
    amountInStandardUnit = amount * FUEL_CONVERSION_FACTORS.natural_gas_m3_to_thous_m3;
  }

  return amountInStandardUnit * emissionFactor.co2;
}

/**
 * Функция для расчета выбросов CO₂ от электроэнергии
 */
export function calculateElectricityEmissions(
  amount: number,
  unit: 'кВт·ч' | 'МВт·ч'
): number {
  const emissionFactor = EMISSION_FACTORS_ELECTRICITY.russia_2024;

  let amountInMWh = amount;
  if (unit === 'кВт·ч') {
    amountInMWh = amount * FUEL_CONVERSION_FACTORS.electricity_kwh_to_mwh;
  }

  return amountInMWh * emissionFactor.co2;
}

/**
 * Функция для расчета выбросов CO₂ от теплоэнергии
 */
export function calculateHeatEmissions(
  amount: number,
  unit: 'Гкал'
): number {
  const emissionFactor = EMISSION_FACTORS_HEAT.russia_2024;
  return amount * emissionFactor.co2;
}

/**
 * Расчет CO₂-эквивалента с учетом всех парниковых газов
 */
export function calculateCO2Equivalent(emissions: {
  co2: number;
  ch4?: number;
  n2o?: number;
}): number {
  const co2Eq =
    emissions.co2 * GLOBAL_WARMING_POTENTIAL.CO2 +
    (emissions.ch4 || 0) * GLOBAL_WARMING_POTENTIAL.CH4 +
    (emissions.n2o || 0) * GLOBAL_WARMING_POTENTIAL.N2O;

  return Math.round(co2Eq * 100) / 100;
}

/**
 * Расчет выбросов всех парниковых газов из топлива
 */
export function calculateFuelEmissionsDetailed(
  fuelType: keyof FuelEmissionData,
  amount: number,
  unit: 'л' | 'т' | 'м³' | 'тыс. м³'
): {
  co2: number;
  ch4: number;
  n2o: number;
  co2Equivalent: number;
} {
  const emissionFactor = EMISSION_FACTORS_FUEL[fuelType];
  if (!emissionFactor) {
    throw new Error(`Unknown fuel type: ${fuelType}`);
  }

  let amountInStandardUnit = amount;

  // Преобразуем в стандартные единицы
  if (fuelType === 'gasoline' && unit === 'л') {
    amountInStandardUnit = amount * FUEL_CONVERSION_FACTORS.gasoline_l_to_t;
  } else if (fuelType === 'diesel' && unit === 'л') {
    amountInStandardUnit = amount * FUEL_CONVERSION_FACTORS.diesel_l_to_t;
  } else if (fuelType === 'natural_gas' && unit === 'м³') {
    amountInStandardUnit = amount * FUEL_CONVERSION_FACTORS.natural_gas_m3_to_thous_m3;
  }

  const co2 = amountInStandardUnit * emissionFactor.co2;
  const ch4 = amountInStandardUnit * (emissionFactor.ch4 || 0);
  const n2o = amountInStandardUnit * (emissionFactor.n2o || 0);

  return {
    co2: Math.round(co2 * 100) / 100,
    ch4: Math.round(ch4 * 1000) / 1000, // Больше знаков для малых значений
    n2o: Math.round(n2o * 1000) / 1000,
    co2Equivalent: calculateCO2Equivalent({ co2, ch4, n2o }),
  };
}

/**
 * Универсальная функция расчета выбросов
 */
export function calculateEmissions(params: {
  type: 'fuel' | 'electricity' | 'heat';
  subtype?: keyof FuelEmissionData;
  amount: number;
  unit: string;
}): {
  emissions: number;
  emissionFactor: EmissionFactor;
  calculation: string;
} {
  const { type, subtype, amount, unit } = params;

  let emissions = 0;
  let emissionFactor: EmissionFactor;
  let calculation = '';

  switch (type) {
    case 'fuel':
      if (!subtype) throw new Error('Fuel subtype is required');
      emissions = calculateFuelEmissions(
        subtype,
        amount,
        unit as 'л' | 'т' | 'м³' | 'тыс. м³'
      );
      emissionFactor = EMISSION_FACTORS_FUEL[subtype];
      calculation = `${amount} ${unit} × ${emissionFactor.co2} ${emissionFactor.unit}`;
      break;

    case 'electricity':
      emissions = calculateElectricityEmissions(
        amount,
        unit as 'кВт·ч' | 'МВт·ч'
      );
      emissionFactor = EMISSION_FACTORS_ELECTRICITY.russia_2024;
      calculation = `${amount} ${unit} × ${emissionFactor.co2} ${emissionFactor.unit}`;
      break;

    case 'heat':
      emissions = calculateHeatEmissions(amount, unit as 'Гкал');
      emissionFactor = EMISSION_FACTORS_HEAT.russia_2024;
      calculation = `${amount} ${unit} × ${emissionFactor.co2} ${emissionFactor.unit}`;
      break;

    default:
      throw new Error(`Unknown emission type: ${type}`);
  }

  return {
    emissions: Math.round(emissions * 100) / 100, // Округляем до 2 знаков
    emissionFactor,
    calculation
  };
}

/**
 * Экспорт типов для использования в других модулях
 */
export type {
  EmissionFactor,
  FuelEmissionData,
  ElectricityEmissionData,
  HeatEmissionData
};
