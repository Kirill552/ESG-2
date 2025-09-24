/**
 * CAPTCHA Verification API
 * Проверяет CAPTCHA токены от различных провайдеров
 */

import { NextRequest, NextResponse } from 'next/server';
import CaptchaService from '@/lib/captcha-service';
import { getClientIP } from '@/lib/ip-utils';

export async function POST(request: NextRequest) {
  try {
    const { token, action } = await request.json();
    
    if (!token) {
      return NextResponse.json(
        { error: 'CAPTCHA token is required' },
        { status: 400 }
      );
    }

    const clientIP = getClientIP(request);
    const result = await CaptchaService.validateForAuth(token, clientIP, action);
    
    if (result.valid) {
      return NextResponse.json({ 
        success: true,
        message: 'CAPTCHA verified successfully'
      });
    } else {
      return NextResponse.json(
        { 
          error: result.reason || 'CAPTCHA verification failed',
          success: false
        },
        { status: 400 }
      );
    }
    
  } catch (error) {
    console.error('CAPTCHA verification error:', error);
    
    return NextResponse.json(
      { error: 'Internal verification error' },
      { status: 500 }
    );
  }
}
