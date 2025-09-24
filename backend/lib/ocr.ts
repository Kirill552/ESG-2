// lib/ocr.ts
import { createWorker, Worker } from 'tesseract.js';
import ExcelJS from 'exceljs';
// Для старых .xls добавим мягкий fallback через sheetjs (если установлен)
let XLSX: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  XLSX = require('xlsx');
} catch {}
import { getFileBuffer } from './s3';

// Импорт Sharp для предобработки изображений
let sharp: any = null;
try {
  sharp = require('sharp');
} catch (error) {
  console.warn('⚠️ Sharp not available, image preprocessing disabled');
}

const DEBUG = process.env.DEBUG_OCR === 'true';
const log = (...args: any[]) => DEBUG && console.log('🔍 OCR:', ...args);

let worker: Worker | null = null;

/**
 * Предобработка изображения для улучшения OCR с помощью Sharp
 */
async function preprocessImageForOCR(buffer: Buffer): Promise<Buffer> {
  if (!sharp) {
    log('Sharp not available, skipping image preprocessing');
    return buffer;
  }

  try {
    log('Preprocessing image for better OCR recognition...');
    
    // Получаем метаданные изображения
    const metadata = await sharp(buffer).metadata();
    const { width, height } = metadata;
    
    if (!width || !height) {
      log('Could not get image dimensions, skipping preprocessing');
      return buffer;
    }

    log(`Original image: ${width}x${height}px`);

    // Определяем нужно ли масштабирование (OCR лучше работает с изображениями 1200-2400px по ширине)
    const targetWidth = Math.min(Math.max(width, 1200), 2400);
    const scaleFactor = targetWidth / width;
    const targetHeight = Math.round(height * scaleFactor);

    log(`Target dimensions: ${targetWidth}x${targetHeight}px (scale: ${scaleFactor.toFixed(2)})`);

    // Применяем предобработку:
    // 1. Масштабируем если нужно
    // 2. Нормализуем контраст
    // 3. Конвертируем в оттенки серого
    // 4. Применяем легкую резкость
    // 5. Убираем шум
    const processedBuffer = await sharp(buffer)
      .resize(targetWidth, targetHeight, {
        kernel: 'lanczos3', // Лучший алгоритм интерполяции для текста
        fit: 'fill'
      })
      .normalize({ // Улучшаем контраст
        lower: 2,  // Более агрессивная нормализация для текста
        upper: 98
      })
      .greyscale() // Оттенки серого улучшают распознавание текста
      .sharpen({ // Легкая резкость для четкости букв
        sigma: 0.5,
        m1: 0.5,
        m2: 2.0
      })
      .median(1) // Убираем мелкий шум
      .png({ // PNG для лучшего качества
        compressionLevel: 6,
        quality: 100
      })
      .toBuffer();

    log(`Image preprocessed successfully: ${buffer.length} → ${processedBuffer.length} bytes`);
    return processedBuffer;
    
  } catch (error: any) {
    log('Image preprocessing failed, using original:', error.message);
    return buffer;
  }
}

async function getWorker(): Promise<Worker> {
  if (worker) return worker;

  log('Initializing Tesseract worker (fallback mode)...');
  
  try {
    // Простая инициализация для Tesseract.js 4.x без logger
    worker = await createWorker();
    
    // Загружаем русский и английский языки для лучшего распознавания
    await worker.loadLanguage('eng+rus');
    await worker.initialize('eng+rus');
    
    // Оптимизированные параметры для русских документов
    await worker.setParameters({
      tessedit_pageseg_mode: '6', // uniform text block
      preserve_interword_spaces: '1',
      tessedit_char_whitelist: 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюяABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,;:!?()-=+/*%№₽$€ '
    });
    
    log('Tesseract worker initialized successfully as fallback OCR');
    return worker;
  } catch (error: any) {
    log('Tesseract worker initialization failed:', error.message);
    throw new Error(`TESSERACT_INIT_FAILED: ${error.message}`);
  }
}

export async function closeWorker() {
  if (worker) {
    await worker.terminate();
    worker = null;
    log('Tesseract worker terminated');
  }
}

export async function processPdfBuffer(buf: Buffer): Promise<string> {
  try {
    // гарантия, что это именно Buffer
    const dataBuffer = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);

    // берём «чистый» CommonJS модуль, чтобы webpack не подменял пути
    const pdfParse = require('pdf-parse');      // НЕ import()
    const data = await pdfParse(dataBuffer);    // pdfParse возвращает { text, numpages ... }

    const text = data.text || '';
    return text.length > 10000 ? text.slice(0, 10000) : text;
  } catch (e: any) {
    throw new Error(`PDF_PARSE_FAILED: ${e.message}`);
  }
}

async function processImage(buffer: Buffer): Promise<string> {
  try {
    log(`Processing image OCR (${buffer.length} bytes)`);
    
    // Предобрабатываем изображение для лучшего распознавания
    const preprocessedBuffer = await preprocessImageForOCR(buffer);
    
    const w = await getWorker();
    const { data: { text } } = await w.recognize(preprocessedBuffer);
    log(`OCR text extracted: ${text.length} characters`);
    return text.length > 10000 ? text.slice(0, 10000) : text;
  } catch (e: any) {
    log('OCR processing failed:', e.message);
    throw new Error(`OCR_FAILED: ${e.message}`);
  }
}

// Детальная функция для гибридного OCR
async function processImageDetailed(buffer: Buffer): Promise<{
  text: string;
  confidence: number;
  words?: Array<{
    text: string;
    confidence: number;
    bbox?: { x: number; y: number; width: number; height: number };
  }>;
}> {
  try {
    log(`Processing detailed image OCR (${buffer.length} bytes)`);
    
    // Предобрабатываем изображение для лучшего распознавания
    const preprocessedBuffer = await preprocessImageForOCR(buffer);
    
    const w = await getWorker();
    const { data } = await w.recognize(preprocessedBuffer);
    
    // Рассчитываем среднюю уверенность из всех слов
    let totalConfidence = 0;
    let wordCount = 0;
    const detailedWords: any[] = [];

    if (data.words) {
      data.words.forEach((word: any) => {
        if (word.confidence !== undefined) {
          totalConfidence += word.confidence;
          wordCount++;
          detailedWords.push({
            text: word.text || '',
            confidence: word.confidence / 100, // Tesseract возвращает 0-100, нормализуем к 0-1
            bbox: word.bbox ? {
              x: word.bbox.x0,
              y: word.bbox.y0,
              width: word.bbox.x1 - word.bbox.x0,
              height: word.bbox.y1 - word.bbox.y0
            } : undefined
          });
        }
      });
    }

    const averageConfidence = wordCount > 0 ? (totalConfidence / wordCount) / 100 : 0.5;
    const text = data.text.length > 10000 ? data.text.slice(0, 10000) : data.text;

    log(`Detailed OCR completed: ${text.length} characters, confidence: ${averageConfidence}`);
    
    return {
      text,
      confidence: averageConfidence,
      words: detailedWords
    };
  } catch (e: any) {
    log('Detailed OCR processing failed:', e.message);
    throw new Error(`OCR_DETAILED_FAILED: ${e.message}`);
  }
}

export async function processS3File(fileKey: string): Promise<string> {
  try {
    log(`Processing S3 file: ${fileKey}`);
    
    // Скачиваем файл из S3
    const { buffer, mime } = await getFileBuffer(fileKey);
    log(`File downloaded. Size: ${buffer.length} bytes, MIME: ${mime}`);
    
    // Определяем тип файла по MIME и расширению
    const fileName = fileKey.toLowerCase();
    
    if (mime === 'application/vnd.ms-excel' || fileName.endsWith('.xls') || 
        mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || fileName.endsWith('.xlsx')) {
      log('Processing as Excel file (.xls/.xlsx)');
      return processExcelBuffer(Buffer.from(buffer));
    }
    
    if (mime === 'application/pdf' || fileName.endsWith('.pdf')) {
      log('Processing as PDF file');
      return processPdfBuffer(Buffer.from(buffer));
    }
    
    log('Processing as image file');
    return processImage(Buffer.from(buffer));
  } catch (e: any) {
    log('S3 file processing failed:', e.message);
    throw new Error(`S3_FILE_PROCESS_FAILED: ${e.message}`);
  }
}

export async function processExcelBuffer(buf: Buffer): Promise<string> {
  try {
    log(`Processing Excel buffer. Size: ${buf.length} bytes`);
    
    // Читаем Excel файл с помощью ExcelJS
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buf as any);
    } catch (e: any) {
      // Если это legacy .xls или ExcelJS не смог прочитать — пробуем SheetJS
      if (XLSX) {
        log('ExcelJS failed, trying SheetJS (XLS/XLSX) fallback');
        // Улучшенная обработка старых .xls с кириллицей (cp1251) и плотным форматом
        const wb = XLSX.read(buf, { type: 'buffer', codepage: 1251, dense: true, WTF: false });
        let extractedText = '';
        wb.SheetNames.forEach((sheetName: string) => {
          const ws = wb.Sheets[sheetName];
          // Предпочитаем sheet_to_json(header:1) — меньше артефактов, чем CSV
          const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false, raw: false });
          if (rows && rows.length) {
            extractedText += `\n=== ЛИСТ: ${sheetName} ===\n` + rows
              .map((cells: any[], idx: number) => {
                const line = cells.map((c) => (c === null || c === undefined) ? '' : String(c).trim()).join(' | ');
                return line.trim().length > 0 ? `Строка ${idx + 1}: ${line}` : '';
              })
              .filter(Boolean)
              .join('\n');
          }
        });
        if (extractedText.length < 10) {
          // Альтернатива: пробуем CSV как последний шанс
          wb.SheetNames.forEach((sheetName: string) => {
            const ws = wb.Sheets[sheetName];
            const csv = XLSX.utils.sheet_to_csv(ws, { FS: '|', RS: '\n' });
            if (csv && csv.trim().length > 0) {
              extractedText += `\n=== ЛИСТ: ${sheetName} ===\n` + csv
                .split('\n')
                .filter((line: string) => line.trim().length > 0)
                .map((line: string, idx: number) => `Строка ${idx + 1}: ${line}`)
                .join('\n');
            }
          });
        }
        if (extractedText.length < 10) {
          throw new Error('Extracted text is too short, file might be empty or corrupted');
        }
        return extractedText;
      }
      throw e;
    }
    
    log(`Excel workbook loaded successfully. Sheets: ${workbook.worksheets.length}`);
    
    let extractedText = '';
    
    // Обрабатываем все листы
    workbook.worksheets.forEach((worksheet, index) => {
      const sheetName = worksheet.name || `Sheet ${index + 1}`;
      extractedText += `\n=== ЛИСТ: ${sheetName} ===\n`;

      // Более надёжный проход по значениям строк с includeEmpty: true
      const maxCols = worksheet.columnCount || 0;
      worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        // row.values — массив с 1‑го индекса
        const values = Array.isArray((row as any).values) ? (row as any).values.slice(1) : [];
        const cells: string[] = [];
        const toText = (v: any): string => {
          if (v === null || v === undefined) return '';
          // Объекты из ExcelJS: richText, formula, hyperlink, shared string, т.д.
          if (typeof v === 'object') {
            if ('richText' in v && Array.isArray(v.richText)) {
              return v.richText.map((rt: any) => rt?.text ?? '').join('');
            }
            if ('text' in v && typeof v.text === 'string') {
              return v.text;
            }
            if ('result' in v) {
              return String(v.result ?? '');
            }
          }
          if (v instanceof Date) return v.toLocaleDateString('ru-RU');
          return String(v);
        };

        // Гарантируем фиксированное число столбцов для корректного join
        const normalized = values.length < maxCols ? values.concat(Array(maxCols - values.length).fill('')) : values;
        for (const v of normalized) {
          let text = '';
          try {
            text = (row as any).getCell ? ((row as any).getCell(cells.length + 1).text || '').toString().trim() : '';
          } catch { /* ignore */ }
          if (!text) text = toText(v).toString().trim();
          cells.push(text);
        }
        const line = cells.join(' | ').trim();
        if (line.length > 0) {
          extractedText += `Строка ${rowNumber}: ${line}\n`;
        }
      });
    });
    
    log(`Excel text extracted successfully. Length: ${extractedText.length} characters`);
    
    if (extractedText.length < 10) {
      // Последняя попытка: если подключен SheetJS — прочитать как .xls/.xlsx c cp1251
      if (XLSX) {
        try {
          const wb = XLSX.read(buf, { type: 'buffer', codepage: 1251, dense: true });
          let sheetText = '';
          wb.SheetNames.forEach((sheetName: string) => {
            const ws = wb.Sheets[sheetName];
            const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false, raw: false });
            if (rows && rows.length) {
              sheetText += `\n=== ЛИСТ: ${sheetName} ===\n` + rows
                .map((cells: any[], idx: number) => {
                  const line = cells.map((c) => (c === null || c === undefined) ? '' : String(c).trim()).join(' | ');
                  return line.trim().length > 0 ? `Строка ${idx + 1}: ${line}` : '';
                })
                .filter(Boolean)
                .join('\n');
            }
          });
          if (sheetText.length >= 10) {
            return sheetText;
          }
        } catch {}
      }
      throw new Error('Extracted text is too short, file might be empty or corrupted');
    }
    
    return extractedText;
    
  } catch (e: any) {
    log('Excel processing failed:', e.message);
    throw new Error(`EXCEL_PARSE_FAILED: ${e.message}`);
  }
}

export async function processRemoteImage(url: string): Promise<string> {
  try {
    log(`Processing remote image: ${url}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const buf = Buffer.from(await res.arrayBuffer());
    return processImage(buf);
  } catch (e: any) {
    log('Remote image processing failed:', e.message);
    throw new Error(`REMOTE_IMAGE_FAILED: ${e.message}`);
  }
}

export function extractEsgData(text: string): Record<string, any> {
  const esg: Record<string, any> = {};
  try {
    const num = (s: string) => parseFloat(s.replace(/[^\d.,]/g, '').replace(',', '.'));
    const eMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:kw[h·]\s*|kwh|kw)/i);
    if (eMatch) esg.energyConsumption = num(eMatch[0]);
    const co2Match = text.match(/(\d+(?:[.,]\d+)?)\s*(?:tonn?\s*co2|t\s*co2|kg\s*co2)/i);
    if (co2Match) esg.co2Emissions = num(co2Match[0]);
    log('ESG data extracted:', esg);
  } catch (e) { /* ignore */ }
  return esg;
}

// Экспортируем processImage для использования в гибридном сервисе
export { processImage, processImageDetailed }; 