/**
 * Regex-based fallback для извлечения данных из транспортных документов
 * Используется когда GLM не справляется с извлечением данных
 */

export interface TransportData {
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
  confidence: number;
}

/**
 * Извлекает данные о транспортном средстве
 */
function extractVehicle(text: string): { model: string; licensePlate: string; confidence: number } {
  // Паттерн для марки автомобиля (КАМАЗ, Газель, МАЗ, и т.д.)
  const vehicleModels = [
    'КАМАЗ', 'Камаз', 'камаз',
    'Газель', 'ГАЗЕЛЬ', 'газель',
    'МАЗ', 'Маз', 'маз',
    'ЗИЛ', 'Зил', 'зил',
    'Мерседес', 'МЕРСЕДЕС', 'мерседес', 'Mercedes',
    'Вольво', 'VOLVO', 'Volvo',
    'Скания', 'SCANIA', 'Scania',
    'МАН', 'MAN', 'Man',
    'Фура', 'фура', 'ФУРА',
    'Тягач', 'тягач', 'ТЯГАЧ'
  ];

  let model = '';
  let modelConfidence = 0;

  // Ищем марку автомобиля
  for (const vehicleModel of vehicleModels) {
    const regex = new RegExp(`(${vehicleModel})(?:\\s+|\\,|\\.)`, 'i');
    const match = text.match(regex);
    if (match) {
      model = match[1];
      modelConfidence = 0.9;
      break;
    }
  }

  // Паттерн для госномера (различные форматы)
  // Примеры: "Т 223 НМ 196", "К123АВ77", "Р395АУ40", "А 123 ВС 199 RUS"
  const licensePlatePatterns = [
    /([А-ЯЁ]\s?\d{3}\s?[А-ЯЁ]{2}\s?\d{2,3}(?:\s?RUS)?)/gi,  // Т 223 НМ 196 RUS
    /([А-ЯЁ]\d{3}[А-ЯЁ]{2}\d{2,3})/gi,                      // К123АВ77
    /(?:г\/н|госномер|гос\.номер|номер)[:\s]+([А-ЯЁ\d\s]{8,15})/gi  // После слова "госномер"
  ];

  let licensePlate = '';
  for (const pattern of licensePlatePatterns) {
    const match = text.match(pattern);
    if (match) {
      licensePlate = match[0].trim();
      break;
    }
  }

  return {
    model: model || '',
    licensePlate: licensePlate || '',
    confidence: (model && licensePlate) ? 0.85 : (model || licensePlate) ? 0.5 : 0
  };
}

/**
 * Извлекает данные о маршруте
 */
function extractRoute(text: string): { from: string; to: string; fromCity: string; toCity: string; confidence: number } {
  // Паттерны для маршрута
  const routePatterns = [
    // "Маршрут: Москва → Санкт-Петербург"
    /(?:Маршрут|маршрут)[:\s]+([^→\-]+)(?:→|\-|до)([^\n\r\.,]+)/i,

    // "Пункт отправления: ... Пункт назначения: ..."
    /(?:Пункт отправления|Откуда|От)[:\s]+([^\n\r]+?)(?=Пункт назначения|Куда|До|\\n)/i,

    // "г. Москва - г. Санкт-Петербург"
    /(?:г\.|город|с\.|село)\s?([А-ЯЁа-яё\-\s]+?)(?:\s?(?:→|\-|до)\s?)(?:г\.|город|с\.|село)\s?([А-ЯЁа-яё\-\s]+)/i
  ];

  let from = '';
  let to = '';
  let confidence = 0;

  // Пробуем найти маршрут
  for (const pattern of routePatterns) {
    const match = text.match(pattern);
    if (match && match.length >= 3) {
      from = match[1].trim();
      to = match[2].trim();
      confidence = 0.8;
      break;
    }
  }

  // Если не нашли полный маршрут, ищем отдельно "откуда" и "куда"
  if (!from || !to) {
    const fromPattern = /(?:Пункт отправления|Откуда|От|Отправление)[:\s]+([А-ЯЁа-яё\s\-,\.0-9]+?)(?=Пункт назначения|Куда|До|Прибытие|\\n)/i;
    const toPattern = /(?:Пункт назначения|Куда|До|Прибытие)[:\s]+([А-ЯЁа-яё\s\-,\.0-9]+?)(?=\\n|Водитель|Груз|Масса)/i;

    const fromMatch = text.match(fromPattern);
    const toMatch = text.match(toPattern);

    if (fromMatch) from = fromMatch[1].trim();
    if (toMatch) to = toMatch[1].trim();

    if (from && to) confidence = 0.75;
  }

  // Извлекаем только название города (без "г.", области, индекса)
  const extractCityName = (fullAddress: string): string => {
    // Убираем индексы (6 цифр в начале)
    let cleaned = fullAddress.replace(/^\d{6}\s*/, '');

    // Убираем "г.", "город", "с.", "село"
    cleaned = cleaned.replace(/^(?:г\.|город|с\.|село)\s*/i, '');

    // Убираем область/край/республику (все после запятой или "обл.", "край")
    cleaned = cleaned.replace(/[,;]\s*[А-ЯЁа-яё\s]+?(?:обл\.|область|край|республика).*/i, '');
    cleaned = cleaned.replace(/\s+(?:обл\.|область|край|республика).*/i, '');

    return cleaned.trim();
  };

  const fromCity = from ? extractCityName(from) : '';
  const toCity = to ? extractCityName(to) : '';

  return {
    from,
    to,
    fromCity,
    toCity,
    confidence: (fromCity && toCity) ? confidence : confidence * 0.5
  };
}

/**
 * Извлекает данные о грузе
 */
function extractCargo(text: string): { weight: number; unit: string } | undefined {
  // Паттерны для груза
  const cargoPatterns = [
    /(?:Масса|Вес|Груз|масса|вес|груз)[:\s]+(\d+(?:[.,]\d+)?)\s*(т|тонн|кг|килограмм)/i,
    /(?:брутто|нетто)[:\s]+(\d+(?:[.,]\d+)?)\s*(т|тонн|кг|килограмм)/i
  ];

  for (const pattern of cargoPatterns) {
    const match = text.match(pattern);
    if (match) {
      const weight = parseFloat(match[1].replace(',', '.'));
      const unit = match[2].toLowerCase().startsWith('т') ? 'т' : 'кг';
      return { weight, unit };
    }
  }

  return undefined;
}

/**
 * Основная функция извлечения данных с помощью regex
 */
export function extractTransportDataRegex(text: string): TransportData {
  console.log('🔧 Regex fallback: извлечение данных из транспортного документа...');

  const vehicle = extractVehicle(text);
  const route = extractRoute(text);
  const cargo = extractCargo(text);

  // Вычисляем общую уверенность
  const confidence = (vehicle.confidence + route.confidence) / 2;

  console.log('🔍 Regex extraction results:', {
    vehicle: vehicle.model || 'НЕ НАЙДЕНО',
    licensePlate: vehicle.licensePlate || 'НЕ НАЙДЕНО',
    fromCity: route.fromCity || 'НЕ НАЙДЕНО',
    toCity: route.toCity || 'НЕ НАЙДЕНО',
    cargo: cargo ? `${cargo.weight} ${cargo.unit}` : 'НЕ НАЙДЕНО',
    confidence: confidence.toFixed(2)
  });

  return {
    vehicle: {
      model: vehicle.model,
      licensePlate: vehicle.licensePlate,
      modelConfidence: vehicle.confidence
    },
    route: {
      from: route.from,
      to: route.to,
      fromCity: route.fromCity,
      toCity: route.toCity
    },
    cargo,
    confidence
  };
}

/**
 * Проверяет, являются ли извлеченные данные валидными
 */
export function isValidTransportData(data: TransportData): boolean {
  return !!(
    data.vehicle.model &&
    data.vehicle.licensePlate &&
    data.route.fromCity &&
    data.route.toCity
  );
}
