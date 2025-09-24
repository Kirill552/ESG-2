/**
 * Enhanced Report Generator с интеграцией CBAM Pricing
 * Расширяет существующий report-generator.ts для поддержки CBAM тарификации
 */

import { 
  generateReport as baseGenerateReport,
  generateCBAMReport as baseGenerateCBAMReport,
  ReportGenerationData,
  ReportGenerationOptions,
  ReportGenerationResult
} from './report-generator';
import { 
  calculateCBAMPricing,
  checkCBAMSubscription,
  recordCBAMCharges,
  type CBAMLineItem,
  type CBAMPricingCalculation
} from './cbam-pricing';

export interface CBAMReportGenerationData {
  // Основные поля отчета
  org_name: string;
  org_address: string;
  signer_name: string;
  sign_date: string;
  generation_date: string;
  generation_time: string;
  document_id: string;
  organizationId: string;
  
  // Опциональные поля для 296-FZ
  org_inn?: string;
  org_okpo?: string;
  org_oktmo?: string;
  org_phone?: string;
  org_email?: string;
  report_year?: string;
  signer_position?: string;
  
  // Поля для CBAM
  eori?: string;
  cbam_id?: string;
  org_country?: string;
  report_year_q?: string;
  signer_pos?: string;
  
  // Данные о выбросах для CBAM расчетов  
  lineItems?: CBAMLineItem[];
  
  // Динамические поля (product_*_*)
  [key: string]: string | number | boolean | undefined | CBAMLineItem[];
}

export interface CBAMReportGenerationResult extends ReportGenerationResult {
  // Дополнительная информация о CBAM тарификации
  pricingInfo?: {
    calculation: CBAMPricingCalculation;
    hasSubscription: boolean;
    totalCost: number;
    currency: 'RUB';
    chargeApplied: boolean;
  };
  blocked?: boolean;
  blockReason?: string;
}

export interface CBAMReportGenerationOptions extends ReportGenerationOptions {
  // Опции для CBAM тарификации
  skipPricingCheck?: boolean;
  previewMode?: boolean; // Только расчет стоимости без генерации
  applyCharges?: boolean; // Применять ли начисления
}

/**
 * Извлекает данные о выбросах из ReportGenerationData для CBAM расчетов
 */
function extractCBAMLineItems(data: CBAMReportGenerationData): CBAMLineItem[] {
  // Если линии уже переданы напрямую
  if (data.lineItems && data.lineItems.length > 0) {
    return data.lineItems;
  }

  // Извлекаем из динамических полей в формате:
  // product_1_name, product_1_carbon_intensity, product_1_quantity, product_1_emissions
  const lineItems: CBAMLineItem[] = [];
  const productIndexes: Set<number> = new Set();

  // Находим все номера продуктов
  Object.keys(data).forEach(key => {
    const match = key.match(/^product_(\d+)_/);
    if (match) {
      productIndexes.add(parseInt(match[1]));
    }
  });

  // Создаем объекты для каждого продукта
  Array.from(productIndexes).sort().forEach(index => {
    const productName = data[`product_${index}_name`];
    const carbonIntensity = data[`product_${index}_carbon_intensity`];
    const quantity = data[`product_${index}_quantity`];
    const totalEmissions = data[`product_${index}_emissions`];

    if (productName && 
        typeof carbonIntensity === 'number' &&
        typeof quantity === 'number' &&
        typeof totalEmissions === 'number') {
      
      lineItems.push({
        id: `product_${index}`,
        productName: String(productName),
        carbonIntensity,
        quantity,
        totalEmissions
      });
    }
  });

  return lineItems;
}

/**
 * Проверяет возможность генерации CBAM отчета с учетом тарификации
 */
async function checkCBAMGenerationEligibility(
  data: CBAMReportGenerationData,
  options: CBAMReportGenerationOptions = {}
): Promise<{
  canGenerate: boolean;
  pricingCalculation?: CBAMPricingCalculation;
  reason?: string;
}> {
  try {
    const { organizationId } = data;
    const { skipPricingCheck = false } = options;

    if (skipPricingCheck) {
      return { canGenerate: true };
    }

    // Извлекаем данные о выбросах
    const lineItems = extractCBAMLineItems(data);

    if (lineItems.length === 0) {
      return {
        canGenerate: false,
        reason: 'Отсутствуют данные о выбросах для CBAM отчета'
      };
    }

    // Рассчитываем стоимость
    const pricingCalculation = await calculateCBAMPricing({
      organizationId,
      lineItems,
      reportType: 'CBAM_XML' // Предполагаем XML по умолчанию
    });

    // Если есть активный тариф - можно генерировать
    if (pricingCalculation.hasSubscription) {
      return {
        canGenerate: true,
        pricingCalculation
      };
    }

    // Если нет подписки, но стоимость = 0 (например, нет выбросов)
    if (pricingCalculation.totalPrice === 0) {
      return {
        canGenerate: true,
        pricingCalculation
      };
    }

    // Если есть стоимость без подписки - блокируем, требуем оплату или подписку
    return {
      canGenerate: false,
      pricingCalculation,
      reason: `Для генерации CBAM отчета требуется CBAM тариф или оплата ${pricingCalculation.totalPrice}₽`
    };

  } catch (error) {
    console.error('Error checking CBAM generation eligibility:', error);
    return {
      canGenerate: false,
      reason: 'Ошибка при проверке возможности генерации CBAM отчета'
    };
  }
}

/**
 * Расширенная генерация CBAM отчета с поддержкой тарификации
 */
export async function generateCBAMReportWithPricing(
  data: CBAMReportGenerationData,
  options: CBAMReportGenerationOptions = {}
): Promise<CBAMReportGenerationResult> {
  try {
    const { previewMode = false, applyCharges = true } = options;

    console.log(`📋 Генерация CBAM отчета с pricing для ${data.org_name}`);

    // 1. Проверяем возможность генерации
    const eligibilityCheck = await checkCBAMGenerationEligibility(data, options);

    // 2. Если режим предпросмотра - возвращаем расчет даже при блокировке
    if (previewMode) {
      if (eligibilityCheck.pricingCalculation) {
        return {
          success: true,
          blocked: false,
          pricingInfo: {
            calculation: eligibilityCheck.pricingCalculation,
            hasSubscription: eligibilityCheck.pricingCalculation.hasSubscription,
            totalCost: eligibilityCheck.pricingCalculation.totalPrice,
            currency: 'RUB',
            chargeApplied: false
          }
        };
      } else {
        return {
          success: false,
          blocked: false,
          error: eligibilityCheck.reason || 'Не удалось рассчитать стоимость для предпросмотра'
        };
      }
    }

    // 3. Для обычной генерации проверяем блокировку
    if (!eligibilityCheck.canGenerate) {
      return {
        success: false,
        blocked: true,
        blockReason: eligibilityCheck.reason,
        error: eligibilityCheck.reason,
        pricingInfo: eligibilityCheck.pricingCalculation ? {
          calculation: eligibilityCheck.pricingCalculation,
          hasSubscription: eligibilityCheck.pricingCalculation.hasSubscription,
          totalCost: eligibilityCheck.pricingCalculation.totalPrice,
          currency: 'RUB',
          chargeApplied: false
        } : undefined
      };
    }

    // 4. Генерируем отчет обычным способом (шаблоны не изменяем!)
    const { lineItems, organizationId, ...restData } = data;
    
    // Фильтруем только совместимые поля для базового генератора
    const baseData: ReportGenerationData = Object.keys(restData).reduce((acc, key) => {
      const value = (restData as any)[key];
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === undefined) {
        acc[key] = value;
      }
      return acc;
    }, {} as ReportGenerationData);
    
    // Добавляем обязательные поля
    baseData.org_name = data.org_name;
    baseData.org_address = data.org_address;
    baseData.signer_name = data.signer_name;
    baseData.sign_date = data.sign_date;
    baseData.generation_date = data.generation_date;
    baseData.generation_time = data.generation_time;
    baseData.document_id = data.document_id;
    
    const reportResult = await baseGenerateCBAMReport(baseData, options);

    if (!reportResult.success) {
      return {
        ...reportResult,
        blocked: false,
        pricingInfo: eligibilityCheck.pricingCalculation ? {
          calculation: eligibilityCheck.pricingCalculation,
          hasSubscription: eligibilityCheck.pricingCalculation.hasSubscription,
          totalCost: eligibilityCheck.pricingCalculation.totalPrice,
          currency: 'RUB',
          chargeApplied: false
        } : undefined
      };
    }

    // 5. Записываем начисления, если необходимо
    let chargeApplied = false;
    if (applyCharges && eligibilityCheck.pricingCalculation && reportResult.filePath) {
      try {
        // Создаем запись отчета в базе для связи с начислениями
        // (предполагается, что отчет уже сохранен в базе через другие сервисы)
        const reportId = String(data.document_id || `cbam_${Date.now()}`);
        
        await recordCBAMCharges(eligibilityCheck.pricingCalculation, reportId);
        chargeApplied = true;
        
        console.log(`💰 CBAM начисления записаны: ${eligibilityCheck.pricingCalculation.totalPrice}₽`);
      } catch (chargeError) {
        console.error('Error recording CBAM charges:', chargeError);
        // Не блокируем генерацию из-за ошибки записи начислений
      }
    }

    // 6. Возвращаем результат с информацией о тарификации
    return {
      ...reportResult,
      blocked: false,
      pricingInfo: eligibilityCheck.pricingCalculation ? {
        calculation: eligibilityCheck.pricingCalculation,
        hasSubscription: eligibilityCheck.pricingCalculation.hasSubscription,
        totalCost: eligibilityCheck.pricingCalculation.totalPrice,
        currency: 'RUB',
        chargeApplied
      } : undefined
    };

  } catch (error) {
    console.error('Error in generateCBAMReportWithPricing:', error);
    
    return {
      success: false,
      blocked: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка при генерации CBAM отчета'
    };
  }
}

/**
 * Получение предварительного расчета стоимости CBAM отчета
 */
export async function getCBAMReportPricing(
  data: CBAMReportGenerationData
): Promise<{
  success: boolean;
  pricing?: CBAMPricingCalculation;
  canGenerate: boolean;
  reason?: string;
}> {
  try {
    const eligibilityCheck = await checkCBAMGenerationEligibility(data, {
      skipPricingCheck: false
    });

    return {
      success: true,
      pricing: eligibilityCheck.pricingCalculation,
      canGenerate: eligibilityCheck.canGenerate,
      reason: eligibilityCheck.reason
    };

  } catch (error) {
    console.error('Error getting CBAM report pricing:', error);
    
    return {
      success: false,
      canGenerate: false,
      reason: 'Ошибка при расчете стоимости CBAM отчета'
    };
  }
}

/**
 * Wrapper для обычных (не-CBAM) отчетов
 * Использует базовую генерацию без изменений
 */
export async function generate296FZReportWithPricing(
  data: ReportGenerationData,
  options?: ReportGenerationOptions
): Promise<ReportGenerationResult> {
  // Для 296-FZ отчетов используем обычную генерацию
  return baseGenerateReport('296-FZ', data, options);
}

// Экспортируем типы для использования в API
