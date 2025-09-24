/**
 * Math CAPTCHA Challenge API
 * Генерирует математические задачи как fallback
 */

import { NextRequest, NextResponse } from 'next/server';
import CaptchaService from '@/lib/captcha-service';

export async function GET(request: NextRequest) {
  try {
    const challenge = CaptchaService.generateMathChallenge();
    
    // Сохраняем ответ в сессии/кэше для проверки
    // TODO: Implement secure storage for challenge answers
    
    return NextResponse.json({
      challenge: challenge.challenge,
      id: challenge.id
      // Не возвращаем answer на клиент!
    });
    
  } catch (error) {
    console.error('Math CAPTCHA error:', error);
    
    return NextResponse.json(
      { error: 'Failed to generate challenge' },
      { status: 500 }
    );
  }
}
