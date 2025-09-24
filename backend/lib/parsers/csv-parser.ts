/**
 * Парсер для CSV/TSV файлов с автоопределением разделителей и кодировки
 * Специализирован для российских документов с поиском единиц измерения
 */

import { 
  BaseParser, 
  ParsedDocumentData, 
  ParseOptions, 
  ParserResult,
  RussianUnitsHelper 
} from './base-parser';

export class CsvTsvParser extends BaseParser {
  protected readonly supportedFormats = ['csv', 'tsv'];

  /**
   * Парсит CSV/TSV файл с автоопределением формата
   */
  async parse(buffer: Buffer, options: ParseOptions = {}): Promise<ParserResult> {
    const startTime = Date.now();
    
    try {
      // Определяем кодировку
      const encoding = options.encoding === 'auto' || !options.encoding 
        ? this.detectEncoding(buffer) 
        : options.encoding;
      
      console.log(`📄 CSV Parser: detected encoding ${encoding}`);
      
      // Конвертируем буфер в текст
      let text: string;
      if (encoding === 'cp1251') {
        text = this.convertFromCp1251(buffer);
      } else {
        text = buffer.toString(encoding === 'cp866' ? 'binary' : 'utf8');
      }
      
      // Определяем разделитель
      const delimiter = options.delimiter === 'auto' || !options.delimiter
        ? this.detectDelimiter(text)
        : options.delimiter;
        
      console.log(`📄 CSV Parser: detected delimiter '${delimiter}'`);
      
      // Парсим CSV
      const rows = this.parseRows(text, delimiter, options);
      console.log(`📄 CSV Parser: parsed ${rows.length} rows`);
      
      if (rows.length === 0) {
        return {
          success: false,
          error: 'No valid rows found in CSV file',
          processingTime: Date.now() - startTime
        };
      }
      
      // Извлекаем данные по российским единицам
      const extractedUnitsData = this.extractRussianUnitsData(rows);
      
      // Определяем заголовки (первая строка, если содержит текст)
      const headers = this.detectHeaders(rows);
      
      // Оцениваем качество данных
      const dataQuality = RussianUnitsHelper.assessDataQuality(
        extractedUnitsData.russian_units_found, 
        rows.length
      );
      
      const confidence = this.calculateConfidence(extractedUnitsData, rows.length, dataQuality);
      
      const result: ParsedDocumentData = {
        documentType: delimiter === '\t' ? 'csv' : 'csv', // TSV тоже считаем CSV
        confidence,
        extractedData: {
          ...extractedUnitsData,
          raw_rows: options.maxRows ? rows.slice(0, options.maxRows) : rows,
          total_rows: rows.length,
          headers
        },
        metadata: {
          encoding,
          delimiter,
          format_detected: delimiter === '\t' ? 'TSV' : 'CSV',
          processing_time_ms: Date.now() - startTime,
          russian_units_found: extractedUnitsData.russian_units_found,
          data_quality: dataQuality
        }
      };
      
      console.log(`✅ CSV Parser: success! Found ${extractedUnitsData.russian_units_found.length} units, quality: ${dataQuality}`);
      
      return {
        success: true,
        data: result,
        processingTime: Date.now() - startTime
      };
      
    } catch (error) {
      console.error('❌ CSV Parser failed:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Определяет разделитель CSV по частоте встречаемости
   */
  private detectDelimiter(text: string): string {
    const sample = text.split('\n').slice(0, 10).join('\n'); // Первые 10 строк
    
    const delimiters = [',', ';', '\t', '|'];
    const scores: { [key: string]: number } = {};
    
    delimiters.forEach(delimiter => {
      const lines = sample.split('\n');
      const counts = lines.map(line => (line.match(new RegExp(`\\${delimiter}`, 'g')) || []).length);
      
      // Проверяем консистентность (одинаковое количество разделителей в строках)
      const avgCount = counts.reduce((a, b) => a + b, 0) / counts.length;
      const variance = counts.reduce((sum, count) => sum + Math.pow(count - avgCount, 2), 0) / counts.length;
      
      // Чем меньше variance и больше среднее количество, тем лучше
      scores[delimiter] = avgCount > 0 ? avgCount / (1 + variance) : 0;
    });
    
    // Выбираем разделитель с лучшим скором
    const bestDelimiter = Object.entries(scores).reduce((best, [delimiter, score]) => 
      score > best.score ? { delimiter, score } : best, 
      { delimiter: ',', score: 0 }
    );
    
    return bestDelimiter.delimiter;
  }

  /**
   * Парсит строки CSV с учетом кавычек
   */
  private parseRows(text: string, delimiter: string, options: ParseOptions): any[][] {
    const lines = text.split(/\r?\n/);
    const rows: any[][] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Пропускаем пустые строки если указано в опциях
      if (options.skipEmptyRows !== false && (!line || line.length === 0)) {
        continue;
      }
      
      // Парсим строку с учетом кавычек
      const row = this.parseRow(line, delimiter);
      
      if (row.length > 0) {
        rows.push(row);
      }
      
      // Ограничиваем количество строк если указано
      if (options.maxRows && rows.length >= options.maxRows) {
        break;
      }
    }
    
    return rows;
  }

  /**
   * Парсит одну строку CSV с учетом кавычек
   */
  private parseRow(line: string, delimiter: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '"';
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if ((char === '"' || char === "'") && !inQuotes) {
        // Начало кавычек
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar && inQuotes) {
        if (nextChar === quoteChar) {
          // Экранированная кавычка
          current += char;
          i++; // Пропускаем следующий символ
        } else {
          // Конец кавычек
          inQuotes = false;
        }
      } else if (char === delimiter && !inQuotes) {
        // Разделитель вне кавычек
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    // Добавляем последнее поле
    result.push(current.trim());
    
    return result;
  }

  /**
   * Определяет заголовки таблицы
   */
  private detectHeaders(rows: any[][]): string[] | undefined {
    if (rows.length === 0) return undefined;
    
    const firstRow = rows[0];
    
    // Проверяем, содержит ли первая строка в основном текст (заголовки)
    const textFields = firstRow.filter(cell => 
      typeof cell === 'string' && 
      isNaN(parseFloat(cell)) && 
      cell.length > 2
    );
    
    // Если больше половины полей - текстовые, считаем их заголовками
    if (textFields.length > firstRow.length / 2) {
      return firstRow.map(cell => String(cell));
    }
    
    return undefined;
  }

  /**
   * Конвертирует буфер из CP1251 в UTF-8
   */
  private convertFromCp1251(buffer: Buffer): string {
    // Простая реализация для основных русских символов
    // В production среде лучше использовать библиотеку iconv-lite
    const cp1251Map: { [key: number]: string } = {
      192: 'А', 193: 'Б', 194: 'В', 195: 'Г', 196: 'Д', 197: 'Е', 198: 'Ж', 199: 'З',
      200: 'И', 201: 'Й', 202: 'К', 203: 'Л', 204: 'М', 205: 'Н', 206: 'О', 207: 'П',
      208: 'Р', 209: 'С', 210: 'Т', 211: 'У', 212: 'Ф', 213: 'Х', 214: 'Ц', 215: 'Ч',
      216: 'Ш', 217: 'Щ', 218: 'Ъ', 219: 'Ы', 220: 'Ь', 221: 'Э', 222: 'Ю', 223: 'Я',
      224: 'а', 225: 'б', 226: 'в', 227: 'г', 228: 'д', 229: 'е', 230: 'ж', 231: 'з',
      232: 'и', 233: 'й', 234: 'к', 235: 'л', 236: 'м', 237: 'н', 238: 'о', 239: 'п',
      240: 'р', 241: 'с', 242: 'т', 243: 'у', 244: 'ф', 245: 'х', 246: 'ц', 247: 'ч',
      248: 'ш', 249: 'щ', 250: 'ъ', 251: 'ы', 252: 'ь', 253: 'э', 254: 'ю', 255: 'я',
      168: 'Ё', 184: 'ё'
    };
    
    let result = '';
    for (let i = 0; i < buffer.length; i++) {
      const byte = buffer[i];
      if (cp1251Map[byte]) {
        result += cp1251Map[byte];
      } else {
        result += String.fromCharCode(byte);
      }
    }
    
    return result;
  }

  /**
   * Рассчитывает уверенность парсинга
   */
  private calculateConfidence(
    extractedData: any, 
    totalRows: number, 
    dataQuality: 'high' | 'medium' | 'low'
  ): number {
    let confidence = 0.5; // Базовая уверенность для структурного формата
    
    // Бонус за качество данных
    switch (dataQuality) {
      case 'high': confidence += 0.4; break;
      case 'medium': confidence += 0.2; break;
      case 'low': confidence += 0.1; break;
    }
    
    // Бонус за найденные единицы
    const unitsCount = extractedData.russian_units_found.length;
    confidence += Math.min(unitsCount * 0.02, 0.3);
    
    // Бонус за количество строк
    if (totalRows > 10) confidence += 0.1;
    if (totalRows > 50) confidence += 0.1;
    
    return Math.min(confidence, 0.99);
  }
}