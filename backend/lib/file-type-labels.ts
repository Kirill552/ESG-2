/**
 * Человекочитаемые названия типов файлов для UI
 */

export const FILE_TYPE_LABELS: Record<string, string> = {
  // PDF
  'application/pdf': 'PDF',

  // Excel
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
  'application/vnd.ms-excel': 'Excel',

  // Word
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
  'application/msword': 'Word',

  // CSV
  'text/csv': 'CSV',
  'text/tab-separated-values': 'TSV',

  // Текст
  'text/plain': 'Текст',
  'text/html': 'HTML',
  'application/rtf': 'RTF',
  'text/rtf': 'RTF',

  // Изображения
  'image/jpeg': 'JPEG',
  'image/jpg': 'JPEG',
  'image/png': 'PNG',
  'image/gif': 'GIF',
  'image/bmp': 'BMP',
  'image/tiff': 'TIFF',
  'image/webp': 'WebP',

  // JSON/XML
  'application/json': 'JSON',
  'text/json': 'JSON',
  'application/xml': 'XML',
  'text/xml': 'XML',

  // Другие
  'application/zip': 'ZIP',
  'application/x-rar-compressed': 'RAR',
  'application/x-7z-compressed': '7Z',
};

/**
 * Получить человекочитаемое название типа файла
 */
export function getFileTypeLabel(mimeType: string | null | undefined): string {
  if (!mimeType) return 'Неизвестно';

  // Точное совпадение
  if (mimeType in FILE_TYPE_LABELS) {
    return FILE_TYPE_LABELS[mimeType];
  }

  // Извлекаем расширение из MIME типа
  const parts = mimeType.split('/');
  if (parts.length === 2) {
    const subtype = parts[1];

    // Специальные случаи для office форматов
    if (subtype.includes('spreadsheet')) return 'Excel';
    if (subtype.includes('wordprocessing')) return 'Word';
    if (subtype.includes('presentation')) return 'PowerPoint';

    // Общие случаи
    if (subtype.includes('pdf')) return 'PDF';
    if (subtype.includes('excel')) return 'Excel';
    if (subtype.includes('word')) return 'Word';

    // Возвращаем подтип с заглавной буквы
    return subtype.split('.').pop()?.toUpperCase() || 'Файл';
  }

  return 'Файл';
}

/**
 * Получить короткое расширение из MIME типа
 */
export function getFileExtension(mimeType: string | null | undefined, fileName?: string): string {
  // Если есть имя файла, извлекаем расширение из него
  if (fileName) {
    const ext = fileName.split('.').pop();
    if (ext && ext !== fileName) {
      return ext.toUpperCase();
    }
  }

  if (!mimeType) return '';

  const extensionMap: Record<string, string> = {
    'application/pdf': 'PDF',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
    'application/vnd.ms-excel': 'XLS',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
    'application/msword': 'DOC',
    'text/csv': 'CSV',
    'text/plain': 'TXT',
    'image/jpeg': 'JPG',
    'image/png': 'PNG',
    'image/gif': 'GIF',
    'application/json': 'JSON',
    'text/html': 'HTML',
  };

  return extensionMap[mimeType] || '';
}
