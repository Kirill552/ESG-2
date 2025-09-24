/**
 * CAPTCHA Configuration API
 * Возвращает настройки CAPTCHA для клиента
 */

import { NextRequest, NextResponse } from 'next/server';
import CaptchaService from '@/lib/captcha-service';

export async function GET(request: NextRequest) {
  try {
    const config = CaptchaService.getClientConfig();
    
    // Не передаем секретные ключи на клиент
    return NextResponse.json({
      provider: config.provider,
      siteKey: config.siteKey,
      settings: config.settings
    });
    
  } catch (error) {
    console.error('CAPTCHA config error:', error);
    
    return NextResponse.json(
      { error: 'Failed to load CAPTCHA configuration' },
      { status: 500 }
    );
  }
}
