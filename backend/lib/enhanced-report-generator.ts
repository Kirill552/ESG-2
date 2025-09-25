/**
 * Генератор отчетов 296-ФЗ без CBAM и углеродного следа
 * Загружает HTML-шаблон и подставляет значения для организации
 */

import fs from 'node:fs/promises';
import path from 'node:path';

type TemplateValue = string | number | boolean | null | undefined;

export interface ReportGenerationData {
  /** Идентификатор организации в системе */
  organizationId: string;
  /** Человеко-читаемое название организации */
  organizationName: string;
  /** Идентификатор документа/отчета, используется в имени файла */
  documentId: string;
  /** Значения, которые нужно подставить в HTML-шаблон */
  variables?: Record<string, TemplateValue>;
}

export interface ReportGenerationOptions {
  /** Папка, в которую сохранить сгенерированные отчеты */
  outputDir?: string;
  /** Имя файла (по умолчанию вычисляется из documentId) */
  filename?: string;
  /** Отключение записи на диск (true по умолчанию) */
  writeToDisk?: boolean;
}

export interface ReportGenerationResult {
  success: boolean;
  html?: string;
  filePath?: string;
  error?: string;
  meta?: {
    organizationId: string;
    documentId: string;
  };
}

const TEMPLATE_FILENAME = 'ru-296fz-report-2025.html';
const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), 'generated_reports', '296-fz');

let templateCache: string | null = null;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatValue(value: TemplateValue): string {
  if (value === null || value === undefined) {
    return '—';
  }

  if (typeof value === 'boolean') {
    return value ? 'Да' : 'Нет';
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return '—';
    }

    return new Intl.NumberFormat('ru-RU', {
      maximumFractionDigits: 2,
    }).format(value);
  }

  return String(value).trim() || '—';
}

function sanitizeFileName(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9а-яА-ЯёЁ_-]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120) || 'report';
}

async function loadTemplate(): Promise<string> {
  if (templateCache) {
    return templateCache;
  }

  const templatePath = path.join(process.cwd(), 'templates', TEMPLATE_FILENAME);
  templateCache = await fs.readFile(templatePath, 'utf8');
  return templateCache;
}

function renderTemplate(template: string, values: Record<string, TemplateValue>): string {
  let rendered = template;

  for (const [key, value] of Object.entries(values)) {
    const pattern = new RegExp(`\\[\\[${escapeRegExp(key)}\\]\\]`, 'g');
    rendered = rendered.replace(pattern, formatValue(value));
  }

  // Оставшиеся плейсхолдеры заменяем на длинное тире, чтобы отчет выглядел аккуратно
  return rendered.replace(/\[\[(.*?)\]\]/g, '—');
}

export async function generate296FZReport(
  data: ReportGenerationData,
  options: ReportGenerationOptions = {}
): Promise<ReportGenerationResult> {
  try {
    const template = await loadTemplate();
    const now = new Date();

    const baseVariables: Record<string, TemplateValue> = {
      org_name: data.organizationName,
      document_id: data.documentId,
      generation_date: new Intl.DateTimeFormat('ru-RU').format(now),
      generation_time: new Intl.DateTimeFormat('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(now),
    };

    const renderedHtml = renderTemplate(template, {
      ...baseVariables,
      ...(data.variables ?? {}),
    });

    let filePath: string | undefined;

    if (options.writeToDisk !== false) {
      const outputDir = path.resolve(options.outputDir ?? DEFAULT_OUTPUT_DIR);
      await fs.mkdir(outputDir, { recursive: true });

      const filename = options.filename ?? `${sanitizeFileName(data.documentId)}.html`;
      filePath = path.join(outputDir, filename);

      await fs.writeFile(filePath, renderedHtml, 'utf8');
    }

    return {
      success: true,
      html: renderedHtml,
      filePath,
      meta: {
        organizationId: data.organizationId,
        documentId: data.documentId,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка';

    return {
      success: false,
      error: `Не удалось сгенерировать отчет 296-ФЗ: ${message}`,
    };
  }
}

export function clearReportTemplateCache(): void {
  templateCache = null;
}
