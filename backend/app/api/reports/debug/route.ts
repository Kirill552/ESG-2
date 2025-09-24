/**
 * Debug endpoint для отладки данных отчетов
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('🔍 DEBUG: Полученные данные:', JSON.stringify(body, null, 2));
    
    // Анализируем структуру данных
    const analysis = {
      hasCompanyData: !!body.companyData,
      hasEmissionData: !!body.emissionData,
      hasSignerData: !!body.signerData,
      hasGoodsData: !!body.goodsData,
      reportType: body.reportType,
      
      companyDataKeys: body.companyData ? Object.keys(body.companyData) : [],
      emissionDataKeys: body.emissionData ? Object.keys(body.emissionData) : [],
      signerDataKeys: body.signerData ? Object.keys(body.signerData) : [],
      
      // Извлекаем ключевые поля
      extractedData: {
        org_name: body.companyData?.companyName || body.emissionData?.companyName || 'НЕ НАЙДЕНО',
        org_inn: body.companyData?.inn || body.emissionData?.inn || 'НЕ НАЙДЕНО',
        org_address: body.companyData?.address || body.emissionData?.address || 'НЕ НАЙДЕНО',
        signer_name: body.signerData?.name || 'НЕ НАЙДЕНО',
        report_year: body.emissionData?.reportingPeriod || body.reportPeriod || 'НЕ НАЙДЕНО'
      }
    };
    
    console.log('📊 DEBUG: Анализ данных:', JSON.stringify(analysis, null, 2));
    
    return NextResponse.json({
      success: true,
      receivedData: body,
      analysis,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ DEBUG: Ошибка анализа данных:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}