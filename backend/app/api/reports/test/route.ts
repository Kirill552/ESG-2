/**
 * API для тестирования генерации отчетов
 * GET /api/reports/test - тестовая генерация 296-FZ и CBAM отчетов
 */

import { NextResponse } from 'next/server';
import { generate296FZReport, generateCBAMReport, ReportGenerationData } from '@/lib/report-generator';

export async function GET() {
  try {
    console.log('🧪 Запуск тестовой генерации отчетов...');
    
    // Тестовые данные для 296-FZ отчета
    const test296FZData: ReportGenerationData = {
      org_name: 'ООО "Тестовая Компания"',
      org_inn: '1234567890',
      org_okpo: '12345678',
      org_oktmo: '45000000',
      org_address: '123456, г. Москва, ул. Тестовая, д. 1',
      org_phone: '+7 (495) 123-45-67',
      org_email: 'test@company.ru',
      report_year: '2025',
      signer_name: 'Иванов Иван Иванович',
      signer_position: 'Генеральный директор',
      sign_date: new Date().toLocaleDateString('ru-RU'),
      generation_date: new Date().toLocaleDateString('ru-RU'),
      generation_time: new Date().toLocaleTimeString('ru-RU'),
      document_id: `296FZ_TEST_${Date.now()}`
    };
    
    // Тестовые данные для CBAM отчета
    const testCBAMData: ReportGenerationData = {
      org_name: 'ООО "CBAM Тест"',
      org_address: '123456, г. Москва, ул. Экспортная, д. 15',
      org_country: 'RU',
      org_email: 'cbam@test.ru',
      eori: 'RU123456789012345',
      cbam_id: 'DL-2025-TEST123',
      report_year_q: '2025-2',
      signer_name: 'Петров Петр Петрович',
      signer_pos: 'Export Manager',
      sign_date: new Date().toLocaleDateString('ru-RU'),
      generation_date: new Date().toLocaleDateString('ru-RU'),
      generation_time: new Date().toLocaleTimeString('ru-RU'),
      document_id: `CBAM_TEST_${Date.now()}`,
      
      // Тестовые данные товаров
      l1_cn: '72081000',
      l1_qty: '100.0',
      l1_unit: 't',
      l1_origin: 'RU',
      l1_unloc: 'RUMOW',
      l1_inst: 'Test Steel Plant',
      l1_lat: '55.7558',
      l1_lon: '37.6176',
      l1_route: 'BF-BOF',
      l1_dir: '2.500',
      l1_el_mwh: '0.60',
      l1_el_ef: '0.300',
      l1_ef_meth: 'RM',
      l1_steel_id: 'TSP-001',
      l1_ip_in_qty: '110.0',
      l1_ip_in_co2: '165.0',
      l1_ip_out_qty: '100.0',
      l1_ip_out_co2: '250.0',
      
      l2_cn: '72101200',
      l2_qty: '50.0',
      l2_unit: 't',
      l2_origin: 'RU',
      l2_unloc: 'RUMOW',
      l2_inst: 'Test Steel Plant',
      l2_lat: '55.7558',
      l2_lon: '37.6176',
      l2_route: 'EAF',
      l2_dir: '1.800',
      l2_el_mwh: '0.70',
      l2_el_ef: '0.300',
      l2_ef_meth: 'RM',
      l2_steel_id: 'TSP-002',
      l2_ip_in_qty: '55.0',
      l2_ip_in_co2: '82.5',
      l2_ip_out_qty: '50.0',
      l2_ip_out_co2: '90.0',
      
      // Пустая Line 3 для тестирования скрытия
      l3_cn: '',
      l3_qty: '',
      l3_unit: '',
      l3_origin: '',
      l3_unloc: '',
      l3_inst: '',
      l3_lat: '',
      l3_lon: '',
      l3_route: '',
      l3_dir: '',
      l3_el_mwh: '',
      l3_el_ef: '',
      l3_ef_meth: '',
      l3_steel_id: '',
      l3_ip_in_qty: '',
      l3_ip_in_co2: '',
      l3_ip_out_qty: '',
      l3_ip_out_co2: '',
      
      // Итоги (будут рассчитаны автоматически)
      total_quantity: '150.0',
      total_direct_emissions: '340.0',
      total_indirect_emissions: '28.5',
      total_emissions: '368.5'
    };
    
    // Генерируем оба отчета
    const results = await Promise.allSettled([
      generate296FZReport(test296FZData),
      generateCBAMReport(testCBAMData)
    ]);
    
    const [result296FZ, resultCBAM] = results;
    
    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      results: {
        '296-FZ': result296FZ.status === 'fulfilled' ? result296FZ.value : {
          success: false,
          error: result296FZ.reason?.message || 'Неизвестная ошибка'
        },
        'CBAM': resultCBAM.status === 'fulfilled' ? resultCBAM.value : {
          success: false,
          error: resultCBAM.reason?.message || 'Неизвестная ошибка'
        }
      }
    };
    
    // Логируем результаты
    console.log('📋 Результаты тестовой генерации:');
    console.log(`  296-FZ: ${response.results['296-FZ'].success ? '✅' : '❌'}`);
    console.log(`  CBAM: ${response.results['CBAM'].success ? '✅' : '❌'}`);
    
    if (response.results['296-FZ'].success && 'fileName' in response.results['296-FZ']) {
      console.log(`  296-FZ файл: ${response.results['296-FZ'].fileName}`);
    }
    if (response.results['CBAM'].success && 'fileName' in response.results['CBAM']) {
      console.log(`  CBAM файл: ${response.results['CBAM'].fileName}`);
    }
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('❌ Ошибка тестовой генерации отчетов:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}