/**
 * Парсер для Excel файлов (XLSX/XLS) с поддержкой российских единиц измерения
 * Использует ExcelJS для XLSX и fallback на XLSX библиотеку для старых XLS
 */

import ExcelJS from 'exceljs';
import { 
  BaseParser, 
  ParsedDocumentData, 
  ParseOptions, 
  ParserResult,
  RussianUnitsHelper 
} from './base-parser';

// Импорт XLSX библиотеки для старых .xls файлов
let XLSX: any = null;
try {
  XLSX = require('xlsx');
} catch (error) {
  console.warn('XLSX library not available, .xls files will not be supported');
}

export class ExcelParser extends BaseParser {
  protected readonly supportedFormats = ['xlsx', 'xls'];

  /**
   * Парсит Excel файл с автоопределением формата
   */
  async parse(buffer: Buffer, options: ParseOptions = {}): Promise<ParserResult> {
    const startTime = Date.now();
    
    try {
      console.log(`📊 Excel Parser: starting parse (${buffer.length} bytes)`);
      
      // Пытаемся сначала через ExcelJS (для XLSX)
      let worksheetData: any[];
      let sheetNames: string[];
      
      try {
        const result = await this.parseWithExcelJS(buffer, options);
        worksheetData = result.worksheetData;
        sheetNames = result.sheetNames;
        console.log(`📊 Excel Parser: ExcelJS success, ${sheetNames.length} sheets`);
      } catch (exceljsError) {
        console.log(`📊 Excel Parser: ExcelJS failed, trying XLSX library fallback`);
        
        if (!XLSX) {
          throw new Error('XLSX library not available for .xls files');
        }
        
        const result = await this.parseWithXLSX(buffer, options);
        worksheetData = result.worksheetData;
        sheetNames = result.sheetNames;
        console.log(`📊 Excel Parser: XLSX library success, ${sheetNames.length} sheets`);
      }
      
      if (worksheetData.length === 0) {
        return {
          success: false,
          error: 'No data found in Excel sheets',
          processingTime: Date.now() - startTime
        };
      }
      
      // Объединяем данные со всех листов
      const allRows = worksheetData.flat();
      console.log(`📊 Excel Parser: total ${allRows.length} rows from all sheets`);
      
      // Извлекаем данные по российским единицам
      const extractedUnitsData = this.extractRussianUnitsData(allRows);
      
      // Определяем заголовки из первых строк листов
      const headers = this.extractHeaders(worksheetData);
      
      // Оцениваем качество данных
      const dataQuality = RussianUnitsHelper.assessDataQuality(
        extractedUnitsData.russian_units_found, 
        allRows.length
      );
      
      const confidence = this.calculateConfidence(
        extractedUnitsData, 
        allRows.length, 
        dataQuality,
        sheetNames.length
      );
      
      const result: ParsedDocumentData = {
        documentType: 'excel',
        confidence,
        extractedData: {
          ...extractedUnitsData,
          raw_rows: options.maxRows ? allRows.slice(0, options.maxRows) : allRows,
          total_rows: allRows.length,
          headers
        },
        metadata: {
          format_detected: `Excel (${sheetNames.length} sheets: ${sheetNames.join(', ')})`,
          processing_time_ms: Date.now() - startTime,
          russian_units_found: extractedUnitsData.russian_units_found,
          data_quality: dataQuality
        }
      };
      
      console.log(`✅ Excel Parser: success! Found ${extractedUnitsData.russian_units_found.length} units, quality: ${dataQuality}`);
      
      return {
        success: true,
        data: result,
        processingTime: Date.now() - startTime
      };
      
    } catch (error) {
      console.error('❌ Excel Parser failed:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Парсит Excel через ExcelJS (для XLSX файлов)
   */
  private async parseWithExcelJS(buffer: Buffer, options: ParseOptions): Promise<{
    worksheetData: any[][];
    sheetNames: string[];
  }> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    
    const worksheetData: any[][] = [];
    const sheetNames: string[] = [];
    
    workbook.worksheets.forEach((worksheet) => {
      const sheetName = worksheet.name;
      sheetNames.push(sheetName);
      
      console.log(`📋 Processing sheet: ${sheetName} (${worksheet.rowCount} rows)`);
      
      const sheetRows: any[] = [];
      const maxCols = worksheet.columnCount || 20;
      
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        // Пропускаем пустые строки в начале
        if (rowNumber > 1000) return; // Ограничение для производительности
        
        const rowData: any[] = [];
        
        // Извлекаем данные из каждой ячейки
        for (let colIndex = 1; colIndex <= maxCols; colIndex++) {
          const cell = row.getCell(colIndex);
          let cellValue = this.extractCellValue(cell);
          
          rowData.push(cellValue);
        }
        
        // Добавляем строку только если есть данные
        const hasData = rowData.some(cell => 
          cell !== null && cell !== undefined && cell !== ''
        );
        
        if (hasData) {
          sheetRows.push(rowData);
        }
        
        // Ограничиваем количество строк если указано
        if (options.maxRows && sheetRows.length >= options.maxRows) {
          return false; // Прерываем обход
        }
      });
      
      worksheetData.push(...sheetRows);
    });
    
    return { worksheetData, sheetNames };
  }

  /**
   * Парсит Excel через XLSX библиотеку (для XLS файлов)
   */
  private async parseWithXLSX(buffer: Buffer, options: ParseOptions): Promise<{
    worksheetData: any[][];
    sheetNames: string[];
  }> {
    const workbook = XLSX.read(buffer, { 
      type: 'buffer', 
      codepage: 1251, // Для русских файлов
      dense: true 
    });
    
    const worksheetData: any[][] = [];
    const sheetNames = workbook.SheetNames;
    
    sheetNames.forEach(sheetName => {
      console.log(`📋 Processing sheet: ${sheetName}`);
      
      const worksheet = workbook.Sheets[sheetName];
      
      // Конвертируем в массив массивов
      const sheetRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1, 
        defval: '', 
        blankrows: false, 
        raw: false 
      });
      
      // Фильтруем пустые строки и ограничиваем количество
      const filteredRows = sheetRows
        .filter(row => row.some(cell => cell !== null && cell !== undefined && cell !== ''))
        .slice(0, options.maxRows || 1000);
      
      worksheetData.push(...filteredRows);
    });
    
    return { worksheetData, sheetNames };
  }

  /**
   * Извлекает значение из ячейки ExcelJS
   */
  private extractCellValue(cell: any): any {
    if (!cell || cell.value === null || cell.value === undefined) {
      return '';
    }
    
    const value = cell.value;
    
    // Обработка различных типов данных ExcelJS
    if (typeof value === 'object') {
      // Rich text
      if (value.richText && Array.isArray(value.richText)) {
        return value.richText.map((rt: any) => rt.text || '').join('');
      }
      
      // Hyperlink
      if (value.text !== undefined) {
        return value.text;
      }
      
      // Formula result
      if (value.result !== undefined) {
        return value.result;
      }
      
      // Date
      if (value instanceof Date) {
        return value.toLocaleDateString('ru-RU');
      }
    }
    
    // Простые типы
    if (typeof value === 'string' || typeof value === 'number') {
      return value;
    }
    
    return String(value || '');
  }

  /**
   * Извлекает заголовки из первых строк листов
   */
  private extractHeaders(worksheetData: any[][]): string[] | undefined {
    if (worksheetData.length === 0) return undefined;
    
    // Берем первую строку первого листа как потенциальные заголовки
    const firstSheet = worksheetData[0];
    if (!firstSheet || firstSheet.length === 0) return undefined;
    
    const firstRow = Array.isArray(firstSheet[0]) ? firstSheet[0] : firstSheet;
    
    // Проверяем, содержит ли первая строка в основном текст
    const textFields = firstRow.filter(cell => 
      typeof cell === 'string' && 
      isNaN(parseFloat(cell)) && 
      cell.length > 1
    );
    
    // Если больше половины полей - текстовые, считаем их заголовками
    if (textFields.length > firstRow.length / 2) {
      return firstRow.map(cell => String(cell || ''));
    }
    
    return undefined;
  }

  /**
   * Рассчитывает уверенность парсинга Excel
   */
  private calculateConfidence(
    extractedData: any, 
    totalRows: number, 
    dataQuality: 'high' | 'medium' | 'low',
    sheetCount: number
  ): number {
    let confidence = 0.7; // Высокая базовая уверенность для Excel
    
    // Бонус за качество данных
    switch (dataQuality) {
      case 'high': confidence += 0.25; break;
      case 'medium': confidence += 0.15; break;
      case 'low': confidence += 0.05; break;
    }
    
    // Бонус за найденные единицы
    const unitsCount = extractedData.russian_units_found.length;
    confidence += Math.min(unitsCount * 0.01, 0.2);
    
    // Бонус за количество строк
    if (totalRows > 10) confidence += 0.05;
    if (totalRows > 50) confidence += 0.05;
    
    // Небольшой бонус за множественные листы (обычно более структурированные данные)
    if (sheetCount > 1) confidence += 0.02;
    
    return Math.min(confidence, 0.99);
  }

  /**
   * Проверяет, является ли файл Excel форматом
   */
  canParse(filename: string, mimeType?: string): boolean {
    const extension = filename.toLowerCase().split('.').pop();
    
    if (extension && this.supportedFormats.includes(extension)) {
      return true;
    }
    
    // Дополнительная проверка по MIME типу
    if (mimeType) {
      const excelMimeTypes = [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/excel',
        'application/x-excel',
        'application/x-msexcel'
      ];
      
      return excelMimeTypes.includes(mimeType);
    }
    
    return false;
  }
}