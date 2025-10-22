/**
 * Обработка транспортных документов без полных данных о топливе
 * Задачи 10.5 и 10.6 из OCR-REPORTS.md
 */

import { FoundationModelsClient } from './foundation-models-client';

// Типы данных транспортного документа
export interface TransportDocumentData {
  vehicle: {
    model: string;
    licensePlate: string;
    modelConfidence: number;
  };
  route: {
    from: string;
    to: string;
    fromCity: string;
    toCity: string;
  };
  cargo?: {
    weight: number;
    unit: string;
  };
  driver?: string;
  date?: string;
}

// Результат определения типа топлива
export interface FuelTypeResult {
  fuelType: 'gasoline' | 'diesel' | 'unknown';
  confidence: number;
  reasoning: string;
  year?: number;
  engineType?: string;
}

// Результат расчета расстояния
export interface RouteDistanceResult {
  distance: number;
  distanceSource: 'ai' | 'cache' | 'user';
  confidence: number;
  reasoning?: string;
}

// Результат расчета выбросов
export interface EmissionsResult {
  fuelConsumption: number;     // л
  co2Emissions: number;        // кг CO₂
  coefficient: number;         // кг CO₂/л
  calculationMethod: string;   // '296-FZ-transport-prikas-371'
}

// Полный результат обработки транспортного документа
export interface TransportProcessingResult {
  vehicle: TransportDocumentData['vehicle'] & {
    fuelType: FuelTypeResult;
  };
  route: TransportDocumentData['route'] & {
    distance: RouteDistanceResult;
  };
  cargo?: TransportDocumentData['cargo'];
  emissions?: EmissionsResult;
  needsUserReview: boolean;
  confidenceScore: number;       // общая уверенность 0-1
}

// Коэффициенты выбросов для транспорта (кг CO₂/л)
// Источник: Приказ Минприроды РФ №371
const TRANSPORT_EMISSION_FACTORS = {
  gasoline: {
    coefficient: 2.31 * 0.75,   // 2.31 т CO₂/т × 0.75 кг/л = 1.7325 кг CO₂/л
    unit: 'кг CO₂/л',
    description: 'Бензин (все марки: АИ-92, АИ-95, АИ-98)',
    source: 'Приказ №371, пересчет через плотность'
  },
  diesel: {
    coefficient: 2.67 * 0.84,   // 2.67 т CO₂/т × 0.84 кг/л = 2.2428 кг CO₂/л
    unit: 'кг CO₂/л',
    description: 'Дизельное топливо',
    source: 'Приказ №371, пересчет через плотность'
  }
};

// Типовые нормы расхода по типам ТС (л/100 км)
// Источник: Приказ Минтранса РФ от 14.03.2008 N АМ-23-р
const VEHICLE_CONSUMPTION_ESTIMATES: Record<string, number> = {
  'газель': 12.5,
  'камаз': 28.0,
  'фура': 35.0,
  'легковой': 8.0,
  'легковая': 8.0,
  'микроавтобус': 10.0,
  'грузовик': 25.0,
  'тягач': 32.0
};

/**
 * Оценивает расход топлива по модели транспортного средства
 */
function estimateConsumption(vehicleModel: string): number {
  const normalizedModel = vehicleModel.toLowerCase();

  // Поиск ключевого слова в модели
  for (const [key, consumption] of Object.entries(VEHICLE_CONSUMPTION_ESTIMATES)) {
    if (normalizedModel.includes(key)) {
      return consumption;
    }
  }

  // Дефолтный расход для неизвестной модели (средний грузовик)
  console.warn(`⚠️ Неизвестная модель "${vehicleModel}", используем средний расход 20 л/100км`);
  return 20.0;
}

/**
 * Рассчитывает выбросы CO₂ для транспортного документа
 * Задача 10.6.2 из OCR-REPORTS.md
 */
export function calculateTransportEmissions(
  fuelType: 'gasoline' | 'diesel',
  distance: number,              // км
  vehicleModel: string,
  cargoWeight?: number           // тн (опционально для коррекции расхода)
): EmissionsResult {
  console.log(`🧮 Расчет выбросов: ${vehicleModel}, ${distance} км, топливо: ${fuelType}`);

  // 1. Определить базовый расход топлива по модели
  const baseConsumption = estimateConsumption(vehicleModel);

  // 2. Скорректировать на вес груза (если указан)
  const adjustedConsumption = cargoWeight
    ? baseConsumption * (1 + cargoWeight * 0.05) // +5% на каждую тонну
    : baseConsumption;

  // 3. Рассчитать общее потребление топлива
  const totalFuel = (distance / 100) * adjustedConsumption;

  // 4. Применить коэффициент эмиссии
  const coefficient = TRANSPORT_EMISSION_FACTORS[fuelType].coefficient;
  const co2Emissions = totalFuel * coefficient;

  console.log(`✅ Расчет: ${totalFuel.toFixed(2)} л × ${coefficient.toFixed(4)} = ${co2Emissions.toFixed(2)} кг CO₂`);

  return {
    fuelConsumption: totalFuel,
    co2Emissions,
    coefficient,
    calculationMethod: '296-FZ-transport-prikas-371'
  };
}

/**
 * Обрабатывает транспортный документ с параллельными запросами к GLM-4.6
 * Задача 10.5 из OCR-REPORTS.md
 */
export async function processTransportDocumentParallel(
  extractedData: TransportDocumentData,
  foundationModelsClient: FoundationModelsClient
): Promise<TransportProcessingResult> {
  console.log('🚀 Параллельная обработка транспортного документа...');

  const { vehicle, route, cargo } = extractedData;

  try {
    // ✅ ПАРАЛЛЕЛЬНЫЕ ЗАПРОСЫ (экономия времени: 2-3 сек вместо 4-6 сек)
    const [fuelTypeResult, distanceResult] = await Promise.all([
      foundationModelsClient.determineFuelType(vehicle.model, vehicle.licensePlate),
      foundationModelsClient.calculateRouteDistance(route.fromCity, route.toCity)
    ]);

    console.log('✅ Параллельные запросы завершены:', {
      fuelType: fuelTypeResult.fuelType,
      distance: distanceResult.distance
    });

    // Расчет выбросов (если удалось определить топливо и расстояние)
    let emissions: EmissionsResult | undefined;
    if (fuelTypeResult.fuelType !== 'unknown' && distanceResult.distance > 0) {
      emissions = calculateTransportEmissions(
        fuelTypeResult.fuelType,
        distanceResult.distance,
        vehicle.model,
        cargo?.weight
      );
    }

    // Определяем нужен ли ручной пересмотр пользователем
    const needsUserReview =
      fuelTypeResult.confidence < 0.7 ||
      distanceResult.confidence < 0.7 ||
      fuelTypeResult.fuelType === 'unknown' ||
      distanceResult.distance === 0;

    // Общая уверенность в результатах
    const confidenceScore = (fuelTypeResult.confidence + distanceResult.confidence) / 2;

    return {
      vehicle: {
        ...vehicle,
        fuelType: fuelTypeResult
      },
      route: {
        ...route,
        distance: distanceResult
      },
      cargo,
      emissions,
      needsUserReview,
      confidenceScore
    };
  } catch (error) {
    console.error('❌ Ошибка параллельной обработки транспортного документа:', error);

    // Возвращаем результат с низкой уверенностью
    return {
      vehicle: {
        ...vehicle,
        fuelType: {
          fuelType: 'unknown',
          confidence: 0,
          reasoning: 'Ошибка при определении типа топлива'
        }
      },
      route: {
        ...route,
        distance: {
          distance: 0,
          distanceSource: 'ai',
          confidence: 0,
          reasoning: 'Ошибка при расчете расстояния'
        }
      },
      cargo,
      needsUserReview: true,
      confidenceScore: 0
    };
  }
}

/**
 * Экспортируем коэффициенты для использования в других модулях
 */
export { TRANSPORT_EMISSION_FACTORS, VEHICLE_CONSUMPTION_ESTIMATES };
