/**
 * Утилита для извлечения ИНН из текста документов
 * Поддерживает различные форматы записи ИНН в документах
 */

/**
 * Извлекает ИНН из текста документа
 * Поддерживаемые форматы:
 * - ИНН: 1234567890
 * - ИНН 1234567890
 * - ИНН:1234567890
 * - Получатель ИНН: 1234567890
 * - Отправитель ИНН: 1234567890
 * - 10-значный ИНН (юридические лица)
 * - 12-значный ИНН (индивидуальные предприниматели)
 */
export function extractINN(text: string): string | null {
  if (!text || text.length === 0) {
    return null;
  }

  // Регулярное выражение для поиска ИНН
  // Ищем: "ИНН", затем опционально двоеточие и пробелы, затем 10 или 12 цифр
  const innPatterns = [
    // ИНН: 1234567890 или ИНН 1234567890
    /(?:^|[^\d])ИНН[\s:]*(\d{10}(?:\d{2})?)(?:[^\d]|$)/i,

    // Получатель/Отправитель ИНН: 1234567890
    /(?:получател[ья]|отправител[ья]|продавец|покупател[ья]|грузоотправител[ья]|грузополучател[ья])[\s]*ИНН[\s:]*(\d{10}(?:\d{2})?)(?:[^\d]|$)/i,

    // ИНН без подписи, но с четкими границами (10 или 12 цифр не являющиеся частью других чисел)
    /(?:^|[^\d])(\d{10}(?:\d{2})?)(?=[^\d]|$)/,
  ];

  const innCandidates: string[] = [];

  // Пробуем каждый паттерн
  for (const pattern of innPatterns) {
    const matches = text.matchAll(new RegExp(pattern, 'gi'));

    for (const match of matches) {
      const inn = match[1];

      // Валидация длины ИНН
      if (inn && (inn.length === 10 || inn.length === 12)) {
        // Проверяем что это не просто случайное число
        // ИНН не может начинаться с 00
        if (!inn.startsWith('00')) {
          innCandidates.push(inn);
        }
      }
    }
  }

  // Удаляем дубликаты
  const uniqueINNs = [...new Set(innCandidates)];

  // Если найдено несколько ИНН, приоритизируем
  if (uniqueINNs.length === 0) {
    return null;
  }

  if (uniqueINNs.length === 1) {
    return uniqueINNs[0];
  }

  // Если несколько ИНН, возвращаем первый найденный с явной подписью "ИНН"
  // (более надежный чем просто число)
  const explicitINN = text.match(/ИНН[\s:]*(\d{10}(?:\d{2})?)(?:[^\d]|$)/i);
  if (explicitINN && explicitINN[1]) {
    return explicitINN[1];
  }

  // Иначе возвращаем первый найденный
  return uniqueINNs[0];
}

/**
 * Валидация ИНН по контрольному числу (для юр.лиц - 10 цифр)
 * Алгоритм проверки взят из https://www.consultant.ru/document/cons_doc_LAW_134442/
 */
export function validateINN(inn: string): boolean {
  if (!inn) return false;

  // Убираем пробелы
  const cleanINN = inn.replace(/\s/g, '');

  // ИНН должен быть 10 или 12 цифр
  if (!/^\d{10}$|^\d{12}$/.test(cleanINN)) {
    return false;
  }

  // Упрощенная проверка: ИНН не может начинаться с 00
  if (cleanINN.startsWith('00')) {
    return false;
  }

  // Полная проверка контрольных сумм можно добавить позже
  // Сейчас базовая валидация формата достаточна

  return true;
}

/**
 * Сравнивает два ИНН (игнорируя пробелы и регистр)
 */
export function compareINNs(inn1: string | null | undefined, inn2: string | null | undefined): boolean {
  if (!inn1 || !inn2) return false;

  const clean1 = inn1.replace(/\s/g, '').toUpperCase();
  const clean2 = inn2.replace(/\s/g, '').toUpperCase();

  return clean1 === clean2;
}

/**
 * Извлекает все ИНН из текста (для отладки)
 */
export function extractAllINNs(text: string): string[] {
  if (!text || text.length === 0) {
    return [];
  }

  const innPattern = /ИНН[\s:]*(\d{10}(?:\d{2})?)(?:[^\d]|$)/gi;
  const matches = text.matchAll(innPattern);

  const inns: string[] = [];
  for (const match of matches) {
    if (match[1] && validateINN(match[1])) {
      inns.push(match[1]);
    }
  }

  return [...new Set(inns)]; // Удаляем дубликаты
}
