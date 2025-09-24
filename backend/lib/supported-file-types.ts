/**
 * Центральный реестр поддерживаемых типов файлов / расширений.
 * Используется и на клиенте (accept для input/dropzone) и на сервере (валидация MIME).
 * Если нужно расширить — добавляем здесь, а не дублируем в компонентах/роутах.
 *
 * ВНИМАНИЕ: порядок групп важен только для читаемости. MIME → список расширений.
 */

export interface SupportedFileGroup {
  label: string;
  mimes: Record<string, string[]>; // mime -> extensions (с точкой)
}

// Базовые бизнесовые документы + дополнительные востребованные форматы клиентов.
export const SUPPORTED_FILE_GROUPS: SupportedFileGroup[] = [
  {
    label: 'Документы и таблицы',
    mimes: {
      'application/pdf': ['.pdf'],
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/tab-separated-values': ['.tsv'],
      'text/plain': ['.txt', '.log'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'application/vnd.oasis.opendocument.text': ['.odt'],
      'application/vnd.oasis.opendocument.spreadsheet': ['.ods'],
      'application/rtf': ['.rtf'],
      'application/vnd.ms-powerpoint': ['.ppt'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'application/vnd.ms-access': ['.mdb'],
      'application/x-iwork-pages-sffpages': ['.pages'],
      'application/x-iwork-keynote-sffkey': ['.key'],
      'application/x-iwork-numbers-sffnumbers': ['.numbers']
    }
  },
  {
    label: 'Изображения / Скан-копии',
    mimes: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/gif': ['.gif'],
      'image/bmp': ['.bmp'],
      'image/tiff': ['.tiff', '.tif'],
      'image/webp': ['.webp'],
      'image/svg+xml': ['.svg'],
      'image/heic': ['.heic'],
      'image/heif': ['.heif']
    }
  },
  {
    label: 'Структурированные данные',
    mimes: {
      'application/json': ['.json'],
      'application/xml': ['.xml'],
      'text/xml': ['.xml'],
      'text/yaml': ['.yaml', '.yml'],
      'application/x-yaml': ['.yaml', '.yml'],
      'application/vnd.ms-excel.sheet.macroEnabled.12': ['.xlsm']
    }
  },
  {
    label: 'Архивы / контейнеры',
    mimes: {
      'application/zip': ['.zip'],
      'application/x-rar-compressed': ['.rar'],
      'application/x-7z-compressed': ['.7z'],
      'application/x-tar': ['.tar'],
      'application/gzip': ['.gz'],
      'application/x-bzip2': ['.bz2']
    }
  },
  {
    label: 'Специфичные форматы (1С / DBF / др.)',
    mimes: {
      'application/x-dbf': ['.dbf'],
      'application/octet-stream': ['.1cd'] // 1С база (может использоваться для ограниченного импорта метаданных)
    }
  }
];

// Плоский список MIME → применяется на сервере. Если ALLOWED_UPLOAD_MIME_TYPES задан, он переопределит.
export const DEFAULT_ALLOWED_MIME_TYPES: string[] = SUPPORTED_FILE_GROUPS.flatMap(g => Object.keys(g.mimes));

// Генерация accept объекта для react-dropzone: { mime: ext[] }
export function buildDropzoneAccept(): Record<string, string[]> {
  return SUPPORTED_FILE_GROUPS.reduce<Record<string, string[]>>((acc, g) => {
    for (const [mime, exts] of Object.entries(g.mimes)) {
      acc[mime] = exts;
    }
    return acc;
  }, {});
}

// Список всех расширений (для подсказок в UI)
export const ALL_SUPPORTED_EXTENSIONS = Array.from(new Set(
  SUPPORTED_FILE_GROUPS.flatMap(g => Object.values(g.mimes).flat())
)).sort();
